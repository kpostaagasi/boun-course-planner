import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { courseRows, gotoFresh } from "./helpers";

/**
 * PWA / offline slice.
 *
 * Runs on the `pwa` project only (testMatch /pwa\.spec\.ts/), which points at
 * `vite preview` on port 4173 under the real GitHub Pages base path. That is deliberate:
 * registration in `src/main.ts` is gated on `import.meta.env.PROD`, so the dev server can
 * never activate a worker. These assertions therefore run against the actual production
 * artifact, not a weakened dev approximation.
 */

const BASE_PATH = "/boun-course-planner/";

/** Resolved state of the active worker, or a sentinel. */
function activeWorkerState(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state ?? "no-active-worker";
  });
}

/** Every URL currently held in the worker's caches, grouped by cache name. */
function cacheContents(page: Page) {
  return page.evaluate(async () => {
    const entries: Record<string, string[]> = {};
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      entries[name] = (await cache.keys()).map((request) => request.url);
    }
    return entries;
  });
}

test.afterEach(async ({ page, context }) => {
  // Leave no worker or cache behind for the next run against this fixed port.
  await context.setOffline(false);
  await page
    .evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
      await Promise.all((await caches.keys()).map((n) => caches.delete(n)));
    })
    .catch(() => {
      // Page already gone; nothing to clean up.
    });
});

test("registers a service worker that reaches the activated state", async ({
  page,
}) => {
  await gotoFresh(page);

  // `navigator.serviceWorker.ready` resolves as soon as a worker is active, which happens
  // while `activate` (and its clients.claim()) is still running - hence poll for the state.
  await expect
    .poll(() => activeWorkerState(page), { timeout: 20_000 })
    .toBe("activated");

  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope
  );
  expect(new URL(scope).pathname).toBe(BASE_PATH);

  const scriptUrl = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).active?.scriptURL ?? ""
  );
  expect(new URL(scriptUrl).pathname).toBe(`${BASE_PATH}sw.js`);
});

test("links a manifest that serves 200 with a real name and existing icons", async ({
  page,
}) => {
  await gotoFresh(page);

  const href = await page.locator("link[rel=manifest]").getAttribute("href");
  expect(href).toBeTruthy();

  const manifestUrl = new URL(href as string, page.url());
  expect(manifestUrl.pathname).toBe(`${BASE_PATH}site.webmanifest`);

  const response = await page.request.get(manifestUrl.toString());
  expect(response.status()).toBe(200);

  const manifest = JSON.parse(await response.text()) as {
    name?: string;
    short_name?: string;
    start_url?: string;
    scope?: string;
    icons?: { src: string; sizes: string }[];
  };

  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();

  // start_url / scope are manifest-relative so they follow the deploy sub-path.
  expect(new URL(manifest.start_url as string, manifestUrl).pathname).toBe(
    BASE_PATH
  );
  expect(new URL(manifest.scope as string, manifestUrl).pathname).toBe(
    BASE_PATH
  );

  const icons = manifest.icons ?? [];
  expect(icons.length).toBeGreaterThan(0);
  for (const icon of icons) {
    const iconUrl = new URL(icon.src, manifestUrl);
    const iconResponse = await page.request.get(iconUrl.toString());
    expect(iconResponse.status(), `icon ${icon.src}`).toBe(200);
  }
});

test("serves the course list from cache with the network switched off", async ({
  page,
  context,
}) => {
  await gotoFresh(page);
  await expect
    .poll(() => activeWorkerState(page), { timeout: 20_000 })
    .toBe("activated");

  // One warm visit: the document that *registered* the worker was not controlled by it
  // while it issued its own data fetches, so this reload is what routes the JSON payload
  // through the worker and populates the data cache - exactly what a returning student hits.
  await page.reload();
  await expect(courseRows(page).first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);

  const caches0 = await cacheContents(page);
  const allCached = Object.values(caches0).flat();
  // Asserted by shape, not by literal version. sw.js's own contract is to bump
  // VERSION whenever the strategies or the precached file set change, so pinning
  // "bcp-shell-v1" here turned every intentional bump into a test failure.
  const cacheNames = Object.keys(caches0).sort();
  expect(cacheNames).toHaveLength(2);
  expect(cacheNames.filter((n) => /^bcp-shell-v\d+$/.test(n))).toHaveLength(1);
  expect(cacheNames.filter((n) => /^bcp-data-v\d+$/.test(n))).toHaveLength(1);

  // The self-hosted webfonts are referenced from the stylesheet, not from
  // index.html, and on a first visit they are requested before the worker
  // controls the page — so they are precached explicitly. Without that, the
  // first "load once, then go offline" trip silently loses the typography.
  // Turkish needs both subsets: ı is in `latin`, İ/ş/ğ in `latin-ext`.
  const cachedFonts = allCached
    .filter((url) => url.endsWith(".woff2"))
    .map((url) => url.split("/").pop())
    .sort();
  expect(cachedFonts).toEqual([
    "plexmono-400-latin-ext.woff2",
    "plexmono-400-latin.woff2",
    "plexmono-600-latin-ext.woff2",
    "plexmono-600-latin.woff2",
    "schibsted-latin-ext.woff2",
    "schibsted-latin.woff2",
  ]);

  // Nothing cross-origin and nothing outside our own deploy path ever gets stored.
  const origin = new URL(page.url()).origin;
  for (const url of allCached) {
    expect(new URL(url).origin, url).toBe(origin);
    expect(new URL(url).pathname.startsWith(BASE_PATH), url).toBe(true);
  }
  expect(
    allCached.some((url) => /\/assets\/index-[^/]+\.js$/.test(url))
  ).toBe(true);
  const dataCacheName = cacheNames.find((n) => /^bcp-data-v\d+$/.test(n))!;
  expect(caches0[dataCacheName].some((url) => url.endsWith(".json"))).toBe(true);

  await context.setOffline(true);

  // Guard against a false pass: prove the emulated outage really reaches worker-initiated
  // fetches. This URL is in no cache, so the only way to answer it is the network - and the
  // worker's own offline response (504) is what we must see.
  const uncachedProbe = await page.evaluate(() =>
    fetch("data/__offline-probe__.json", { cache: "no-store" })
      .then((r) => r.status)
      .catch(() => -1)
  );
  expect(uncachedProbe).toBe(504);

  await page.reload();
  await expect(courseRows(page).first()).toBeVisible();
  expect(await courseRows(page).count()).toBeGreaterThan(0);
});
