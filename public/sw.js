/**
 * BOUN Course Planner — hand-written service worker (no dependencies, no build step).
 *
 * Lives in `public/`, so Vite copies it verbatim to the deploy root. Registration happens
 * from `src/main.ts` at `${BASE_URL}sw.js`, which under GitHub Pages is
 * `/boun-course-planner/sw.js` and locally `/sw.js`. Every URL below is derived from
 * `self.location` instead of being hardcoded to `/`, so the same file works under both.
 *
 * ---------------------------------------------------------------------------
 * App-shell precache: why we parse `index.html` instead of hardcoding a list
 * ---------------------------------------------------------------------------
 * The built entry chunks are content-hashed (`assets/index-<hash>.js`, `-<hash>.css`), so a
 * literal precache array in this file would rot on every deploy. The two honest options are:
 *
 *   (a) generate the precache manifest at build time (a Vite plugin emitting the hashed
 *       names into the SW), or
 *   (b) fetch the shell HTML during `install` and read the hashed names straight out of its
 *       `<script src>` / `<link href>` tags.
 *
 * We use (b). It needs no plugin, no dependency and no codegen, and it precaches exactly the
 * assets the deployed shell actually references — so the app is offline-capable after the
 * *first* visit rather than the second. Tradeoff: the SW pays one extra `index.html` request
 * on install and depends on the entry assets being referenced from markup (true for Vite's
 * `build` output; dynamically imported chunks are not precached and instead land in the cache
 * on first use via the runtime cache-first path below).
 *
 * ---------------------------------------------------------------------------
 * Strategies
 * ---------------------------------------------------------------------------
 *   navigations        network-first, cache fallback  — never serve a stale shell while online,
 *                                                       always render something while offline.
 *   `data/*.json`      stale-while-revalidate         — the scrape pipeline refreshes this at
 *                                                       most once a day, so an instant cached
 *                                                       answer plus a background refresh is
 *                                                       exactly right during registration.
 *   other same-origin  cache-first, network fallback  — safe because entry assets are
 *                                                       content-hashed and immutable; the few
 *                                                       unhashed statics (icons, manifest) are
 *                                                       refreshed by bumping VERSION.
 *
 * Never touched: non-GET requests, anything cross-origin (notably the Google Analytics
 * gtag.js that `GoogleAnalytics.svelte` injects in production), and anything outside our
 * own deploy sub-path.
 *
 * ---------------------------------------------------------------------------
 * Update semantics — deliberately NO skipWaiting()
 * ---------------------------------------------------------------------------
 * A new worker stays `waiting` until every tab of the app is closed. That is the point: a
 * student halfway through picking sections must not have the rug pulled out from under them
 * by a mid-session swap to a different deploy's asset set (the loaded HTML references the old
 * hashed chunks; swapping the worker underneath it would break lazy chunks). `activate`
 * therefore only deletes whole caches belonging to an older VERSION, which by construction
 * happens when no old client is left. Keeping the current cache *bounded* is a separate job
 * and lives on the navigation path instead - see `syncShellAssets` for why.
 * `clients.claim()` *is* called, which matters only on the very first install: there is no
 * previous version to swap out, so claiming lets the page that just registered us route its
 * data fetches through the SW and become offline-capable immediately.
 *
 * Bump VERSION whenever the strategies or the set of unhashed precached files change.
 */

/// <reference lib="webworker" />

// Canonical double-cast for the worker global; the `lib` reference above supplies the type.
const sw = /** @type {ServiceWorkerGlobalScope} */ (
  /** @type {unknown} */ (self)
);

const VERSION = "v3";
const SHELL_CACHE = `bcp-shell-${VERSION}`;
const DATA_CACHE = `bcp-data-${VERSION}`;
const CACHE_PREFIX = "bcp-";
const CURRENT_CACHES = [SHELL_CACHE, DATA_CACHE];

/** Deploy root, e.g. `https://host/boun-course-planner/`. */
const SCOPE_URL = new URL("./", sw.location.href);
/** Canonical shell URLs: what a navigation asks for, and the physical file. */
const SHELL_URL = SCOPE_URL.href;
const SHELL_FILE_URL = new URL("index.html", SCOPE_URL).href;
const DATA_PREFIX = new URL("data/", SCOPE_URL).pathname;
/** Vite's content-hashed build output; the only entries safe to prune. */
const ASSETS_PREFIX = new URL("assets/", SCOPE_URL).pathname;

/**
 * Self-hosted webfonts, precached explicitly.
 *
 * They are referenced from the stylesheet rather than from `index.html`, so
 * `extractShellAssets` cannot see them, and on a first visit the stylesheet
 * requests them before the worker controls the page — which means without this
 * list the very first "load once, then go offline" trip falls back to a system
 * font. Unhashed and stable, so they are precached like the icons and never
 * pruned. Turkish needs both subsets: ı lives in `latin`, İ/ş/ğ in `latin-ext`.
 */
const SHELL_FONTS = [
  "fonts/schibsted-latin.woff2",
  "fonts/schibsted-latin-ext.woff2",
  "fonts/plexmono-400-latin.woff2",
  "fonts/plexmono-400-latin-ext.woff2",
  "fonts/plexmono-600-latin.woff2",
  "fonts/plexmono-600-latin-ext.woff2",
].map((path) => new URL(path, SCOPE_URL).href);

/** `<script src>` / `<link href>` references in the shell HTML. */
const SHELL_ASSET_RE =
  /<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;

/**
 * Pull the asset URLs the deployed shell references, keeping only same-origin ones inside
 * our scope, plus the self-hosted fonts the stylesheet pulls in. Cross-origin tags (notably
 * the analytics script) and `data:` URLs are dropped.
 * @param {string} html
 * @returns {string[]}
 */
function extractShellAssets(html) {
  /** @type {Set<string>} */
  const urls = new Set(SHELL_FONTS);
  for (const match of html.matchAll(SHELL_ASSET_RE)) {
    const raw = match[1] ?? match[2];
    if (!raw || raw.startsWith("data:") || raw.startsWith("#")) continue;
    let url;
    try {
      url = new URL(raw, SHELL_FILE_URL);
    } catch {
      continue;
    }
    if (url.origin !== sw.location.origin) continue;
    if (!url.pathname.startsWith(SCOPE_URL.pathname)) continue;
    url.hash = "";
    urls.add(url.href);
  }
  return [...urls];
}

/**
 * Bring SHELL_CACHE in line with the given shell HTML: add every asset it references that we
 * do not already hold, and drop hashed `assets/` entries it no longer references.
 *
 * This is what keeps the cache both complete and bounded across deploys. Note the deploy
 * path: `sw.js` is a static file, so its bytes are identical from one deploy to the next and
 * the browser therefore never re-runs `install`. Housekeeping that only lived in `install`
 * would be dead code after the very first visit - so this runs from `install` *and* from
 * every successful navigation, which is the one thing guaranteed to happen on a new deploy.
 *
 * Only `assets/` is pruned, never the icons or the manifest. A chunk that was cached lazily
 * rather than referenced from the shell is dropped here and re-cached the next time it is
 * requested online; the deploy that changed the shell had already replaced it server-side.
 *
 * @param {Cache} cache
 * @param {string} html
 * @returns {Promise<void>}
 */
async function syncShellAssets(cache, html) {
  const wanted = extractShellAssets(html);
  const keep = new Set(wanted);
  const existing = await cache.keys();
  const held = new Set(existing.map((request) => request.url));

  // Hashed asset URLs are immutable, so the default cache mode reuses the bytes the page
  // just downloaded instead of paying for them twice. One bad asset must not fail the batch.
  await Promise.allSettled(
    wanted
      .filter((url) => !held.has(url))
      .map((url) => cache.add(new Request(url)))
  );

  await Promise.all(
    existing
      .filter((request) => {
        const { pathname } = new URL(request.url);
        return pathname.startsWith(ASSETS_PREFIX) && !keep.has(request.url);
      })
      .map((request) => cache.delete(request))
  );
}

/**
 * Store the shell under both the directory URL and `index.html`, then sync its assets.
 * @param {Cache} cache
 * @param {Response} response a storable HTML response; consumed here
 * @returns {Promise<void>}
 */
async function cacheShell(cache, response) {
  const forHtml = response.clone();
  const forRoot = response.clone();
  const html = await forHtml.text();
  await cache.put(new Request(SHELL_URL), forRoot);
  await cache.put(new Request(SHELL_FILE_URL), response);
  await syncShellAssets(cache, html);
}

/**
 * Install-time precache of the app shell and everything it references.
 * @returns {Promise<void>}
 */
async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  // `reload` bypasses the HTTP cache: a stale index.html would point at dead hashed chunks.
  const response = await fetch(SHELL_FILE_URL, { cache: "reload" });
  if (!response.ok) throw new Error(`shell fetch failed: ${response.status}`);
  await cacheShell(cache, response);
}

sw.addEventListener("install", (event) => {
  event.waitUntil(precacheShell());
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.includes(name)
          )
          .map((name) => caches.delete(name))
      );
      await sw.clients.claim();
    })()
  );
});

/**
 * @param {Response | undefined} response
 * @returns {boolean} whether the response is ours to store
 */
function isStorable(response) {
  return !!response && response.ok && response.type === "basic";
}

/** @returns {Response} a clean offline failure instead of a rejected fetch. */
function offlineResponse() {
  return new Response("", {
    status: 504,
    statusText: "Offline and not in cache",
  });
}

/**
 * Network-first so an online student never sees a stale shell; cached shell offline.
 *
 * A successful navigation is also our deploy hook: re-caching the shell here refreshes the
 * offline fallback and pulls in the new deploy's hashed assets immediately, instead of
 * waiting for the page to request them one by one.
 *
 * @param {FetchEvent} event
 * @returns {Promise<Response>}
 */
async function handleNavigation(event) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(event.request);
    if (isStorable(response)) {
      event.waitUntil(cacheShell(cache, response.clone()));
    }
    return response;
  } catch {
    const cached =
      (await cache.match(SHELL_URL)) ?? (await cache.match(SHELL_FILE_URL));
    return cached ?? offlineResponse();
  }
}

/**
 * Instant cached JSON plus a background refresh that outlives the response.
 * @param {FetchEvent} event
 * @returns {Promise<Response>}
 */
async function handleData(event) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(event.request, { ignoreVary: true });
  const revalidate = fetch(event.request)
    .then(async (response) => {
      if (isStorable(response)) {
        await cache.put(event.request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    event.waitUntil(revalidate);
    return cached;
  }
  return (await revalidate) ?? offlineResponse();
}

/**
 * Cache-first for immutable hashed assets and small unhashed statics.
 * @param {FetchEvent} event
 * @returns {Promise<Response>}
 */
async function handleAsset(event) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(event.request, { ignoreVary: true });
  if (cached) return cached;
  try {
    const response = await fetch(event.request);
    if (isStorable(response)) {
      event.waitUntil(cache.put(event.request, response.clone()));
    }
    return response;
  } catch {
    return offlineResponse();
  }
}

sw.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only GET is ever cacheable, and we never speak for another origin.
  if (request.method !== "GET") return;
  // DevTools' "only-if-cached" probes must not be intercepted.
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== sw.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_URL.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }
  if (url.pathname.startsWith(DATA_PREFIX) && url.pathname.endsWith(".json")) {
    event.respondWith(handleData(event));
    return;
  }
  event.respondWith(handleAsset(event));
});
