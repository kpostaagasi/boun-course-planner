import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/** Vite dev server that the `desktop` and `mobile` projects drive. */
const DEV_URL = "http://localhost:5173/";

/**
 * `vite.config.ts` derives `base` from `NODE_ENV`, so a production build — the only build that
 * ships a registered service worker — is served under the GitHub Pages base path. `NODE_ENV` is
 * therefore pinned on both halves of the command: the build decides the base baked into
 * `dist/index.html`, and `vite preview` must resolve the same base to serve it.
 *
 * `vite preview` binds `::1` only, so this URL must stay spelled `localhost` (a `127.0.0.1`
 * spelling is refused) and must not gain a `--host` flag.
 */
const PREVIEW_URL = "http://localhost:4173/boun-course-planner/";

/** Specs that need the production build instead of the dev server. */
const PWA_SPEC = /pwa\.spec\.ts/;

/**
 * Small-screen coverage is opt-in per test: tag a test or describe block `@mobile` and it runs on
 * the `mobile` project *instead of* `desktop`. Every spec therefore runs exactly once, and specs
 * written against the two-column desktop layout are never re-run at 390px where they would fail.
 */
const MOBILE_TAG = /@mobile/;

/**
 * Building for the preview server costs a full `vite build`, so only pay for it when a spec
 * actually needs it. Creating `e2e/pwa.spec.ts` arms the second web server with no config change.
 * `PW_NO_PREVIEW=1` suppresses it for a dev-server-only run.
 */
const needsPreview = existsSync("e2e/pwa.spec.ts") && !process.env.PW_NO_PREVIEW;

/**
 * `CI` is exported by assorted local tool harnesses, and the only place this repo genuinely runs
 * unattended is GitHub Actions, so key the CI behaviour off `GITHUB_ACTIONS`. It decides whether an
 * already-running `npm run dev` counts as a port clash (in CI) or as the server to reuse (locally).
 */
const isCI = !!process.env.GITHUB_ACTIONS;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  // Deliberately zero: a spec that only passes on a second attempt is a broken spec, and hiding
  // that behind a retry is exactly the failure mode this suite exists to catch.
  retries: 0,
  workers: isCI ? 2 : undefined,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    // Pinned so language and date assertions do not depend on the machine running the suite:
    // `initLang()` falls back to `navigator.language` when localStorage holds no `lang`.
    locale: "en-US",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: PWA_SPEC,
      grepInvert: MOBILE_TAG,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        baseURL: DEV_URL,
      },
    },
    {
      name: "mobile",
      testIgnore: PWA_SPEC,
      grep: MOBILE_TAG,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        baseURL: DEV_URL,
      },
    },
    {
      name: "pwa",
      testMatch: PWA_SPEC,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        baseURL: PREVIEW_URL,
      },
    },
  ],
  webServer: [
    {
      command: "npm run dev -- --port 5173 --strictPort",
      url: DEV_URL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    ...(needsPreview
      ? [
          {
            command:
              "NODE_ENV=production npm run build && NODE_ENV=production npx vite preview --port 4173 --strictPort",
            url: PREVIEW_URL,
            reuseExistingServer: !isCI,
            timeout: 180_000,
          },
        ]
      : []),
  ],
});
