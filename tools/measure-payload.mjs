/**
 * Initial-load payload gate: how many bytes a first-time visitor downloads
 * before touching anything, and whether that fits the budget.
 *
 * The app's own JavaScript is small (~45 KB gzipped). The JSON it downloads is
 * what actually costs the visitor: the pre-batch baseline was ~379 KB gzipped
 * on first load, 244 KB of which was descriptions.json alone. That file is now
 * lazy (`ensureDescriptions()`), and this script exists so the saving cannot be
 * quietly given back.
 *
 * BUDGET: BUDGET_KB gzipped, total, for everything under `data/` that the app
 * requests without any user interaction. Over budget -> exit 1.
 *
 * ---------------------------------------------------------------- method ----
 * The eager set is *observed*, not declared: the script serves the app, loads
 * it in headless Chromium, records every request, waits for the network to go
 * quiet, and keeps the ones under `data/`. Then it measures the matching files
 * in public/data/ on disk.
 *
 * Static reachability over src/ was tried first and rejected. Whether a fetch
 * is eager is a *branch* question, not a syntax question, and the two cases
 * that matter both prove it:
 *
 *   - descriptions.json is fetched from a branch inside the catalogue search
 *     chain that only runs when a query returns nothing. That chain *is* called
 *     during first render, so a syntactic call-graph must either mark it eager
 *     (over-counting by 244 KB — the entire point of this gate) or special-case
 *     it (a hardcoded exception, i.e. the rot this script is supposed to
 *     prevent).
 *   - quota.json is fetched from a component instantiated inside an `{#each}`
 *     over catalogue rows. `{#each}`-gated code is eager here; `{#if}`-gated
 *     code (the Roadmap panel) is not. Syntax does not tell them apart.
 *
 * Observation has neither problem and cannot go stale: add an eager fetch
 * anywhere and the next run counts it.
 *
 * src/ is still scanned, for two things a browser run cannot give us:
 *   1. the DEFERRED inventory — data files the source can fetch but did not on
 *      initial load — with what each would cost if it became eager;
 *   2. an anti-rot check — every `fetch(` in src/ must be a recognisable
 *      `${import.meta.env.BASE_URL}data/<name>.json` call. One that is not is
 *      a request this script cannot account for, and that fails the run.
 *
 * ------------------------------------------------------------- accuracy ----
 * Reported gzip is `zlib` level 6 (Node's default, and the middle of the range
 * real servers use). nginx defaults to level 1 and would send a little more, so
 * the worst case is printed too; a brotli-capable CDN sends noticeably less.
 * The gate is level 6, which is the level the budget is quoted in.
 *
 * NOT included, and deliberately: the app's own JS/CSS bundle (measuring it
 * needs `vite build`, which this script must not run), HTTP and TLS framing,
 * and third-party requests (Google Analytics in production). This is a
 * data-payload gate, not a full waterfall audit.
 *
 * Duplicate requests are counted once. Three data files are currently fetched
 * twice by two different components each; a browser serves the second from
 * cache, and they are all under 600 B gzipped anyway.
 *
 * Usage:  npm run payload
 * Reuses a dev server already listening on 5173; otherwise starts its own and
 * shuts it down again. Never builds.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

/** Gzipped ceiling for the whole initial data payload. */
const BUDGET_KB = 180;
const BUDGET_BYTES = BUDGET_KB * 1024;

/** Reported and gated level. Node's default; nginx uses 1, static CDNs 9. */
const GZIP_LEVEL = 6;

const DATA_DIR = "public/data";
const SRC_DIR = "src";

/** Dev server this script will reuse if something is already serving on it. */
const REUSE_URL = "http://localhost:5173/";
/** Port for a server of our own, clear of 5173 (dev) and 4173 (vite preview). */
const OWN_PORT = 5183;

/** Quiet period with no new `data/` request that ends the measurement. */
const SETTLE_MS = 1500;
/** Hard cap on the settle loop, so a chatty page cannot hang the gate. */
const SETTLE_LIMIT_MS = 20_000;

/**
 * Every `fetch()` in src/ must look like this. The capture group is the file
 * name, which is `${expr}` for the per-term datasets.
 */
const DATA_FETCH =
  /^fetch\(\s*`\$\{import\.meta\.env\.BASE_URL\}data\/(.+?)\.json`/;

/**
 * @typedef {Object} Sizes
 * @property {number} raw
 * @property {number} gzip     level 6
 * @property {number} gzipMin  level 1, the worst case a real server sends
 * @property {number} brotli   quality 5, typical on-the-fly CDN
 */

/**
 * @param {Buffer} buf
 * @returns {Sizes}
 */
function measure(buf) {
  return {
    raw: buf.length,
    gzip: gzipSync(buf, { level: GZIP_LEVEL }).length,
    gzipMin: gzipSync(buf, { level: 1 }).length,
    brotli: brotliCompressSync(buf, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 5,
        [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
      },
    }).length,
  };
}

/**
 * @param {number} bytes
 * @returns {string}
 */
function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// ---------------------------------------------------------------- source ----

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function sourceFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await sourceFiles(path)));
    } else if (/\.(svelte|ts|mjs|js)$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * @typedef {Object} FetchSite
 * @property {string} file
 * @property {number} line
 * @property {string} target    file name, or "" when the call is unrecognised
 * @property {boolean} dynamic  target is built from an expression
 * @property {string} snippet
 */

/**
 * Every `fetch(` call in src/, with the data file it asks for.
 *
 * Whitespace is collapsed first: several of these calls wrap across lines, and
 * the shape of the call is what matters, not its formatting.
 *
 * @returns {Promise<FetchSite[]>}
 */
async function scanFetchSites() {
  /** @type {FetchSite[]} */
  const sites = [];
  for (const file of await sourceFiles(SRC_DIR)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/\bfetch\(/g)) {
      const at = match.index;
      const call = text.slice(at, at + 240).replace(/\s+/g, " ");
      const hit = DATA_FETCH.exec(call);
      sites.push({
        file: relative(".", file),
        line: text.slice(0, at).split("\n").length,
        target: hit ? `${hit[1]}.json` : "",
        dynamic: hit ? hit[1].includes("${") : false,
        snippet: call.slice(0, 96),
      });
    }
  }
  return sites;
}

// ---------------------------------------------------------------- server ----

/**
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function isServing(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Start a dev server of our own. Never builds: `vite` in dev mode serves
 * public/data/*.json byte-for-byte, which is exactly what is being measured.
 *
 * @returns {Promise<{ url: string, stop: () => void }>}
 */
async function startDevServer() {
  const url = `http://localhost:${OWN_PORT}/`;
  const child = spawn(
    "npm",
    ["run", "dev", "--", "--port", String(OWN_PORT), "--strictPort"],
    { stdio: "ignore" },
  );
  const stop = () => {
    child.kill("SIGTERM");
  };
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `dev server exited with code ${child.exitCode}; is port ${OWN_PORT} taken?`,
      );
    }
    if (await isServing(url)) return { url, stop };
    await new Promise((r) => setTimeout(r, 400));
  }
  stop();
  throw new Error(`dev server did not come up on ${url} within 60s`);
}

// ------------------------------------------------------------- observing ----

/**
 * @typedef {Object} Observation
 * @property {Map<string, number>} requests  data file -> request count
 * @property {string[]} pageErrors
 * @property {boolean} rendered
 */

/**
 * Load the app once, touch nothing, and record what it asks for.
 *
 * @param {string} url
 * @returns {Promise<Observation>}
 */
async function observeInitialLoad(url) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    /** @type {Map<string, number>} */
    const requests = new Map();
    /** @type {string[]} */
    const pageErrors = [];
    let last = Date.now();

    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      const hit = /\/data\/([^/]+\.json)$/.exec(path);
      if (!hit) return;
      requests.set(hit[1], (requests.get(hit[1]) ?? 0) + 1);
      last = Date.now();
    });
    page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 200)));

    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    const until = Date.now() + SETTLE_LIMIT_MS;
    while (Date.now() - last < SETTLE_MS && Date.now() < until) {
      await page.waitForTimeout(200);
    }

    // A page that failed to boot makes no requests, which would otherwise read
    // as a spectacular pass.
    const rendered = await page
      .locator("#app > *")
      .first()
      .isVisible()
      .catch(() => false);
    return { requests, pageErrors, rendered };
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------- report ----

/**
 * @param {string[][]} rows
 * @param {string[]} header
 * @returns {string}
 */
function table(rows, header) {
  const all = [header, ...rows];
  const widths = header.map((_, i) =>
    Math.max(...all.map((row) => (row[i] ?? "").length)),
  );
  const line = (/** @type {string[]} */ row) =>
    row
      .map((cell, i) => (i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i])))
      .join("  ")
      .trimEnd();
  return [
    line(header),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...rows.map(line),
  ].join("\n");
}

async function main() {
  const sites = await scanFetchSites();
  const unaccounted = sites.filter((site) => site.target === "");

  const reuse = await isServing(REUSE_URL);
  const server = reuse ? { url: REUSE_URL, stop: () => {} } : await startDevServer();
  console.log(
    `server: ${server.url}${reuse ? " (reused, already running)" : " (started for this run)"}\n`,
  );

  /** @type {Observation} */
  let observation;
  try {
    observation = await observeInitialLoad(server.url);
  } finally {
    server.stop();
  }

  /** @type {string[]} */
  const failures = [];

  if (!observation.rendered) {
    failures.push(
      "the app did not render, so nothing was measured — check that src/ builds",
    );
  }
  for (const error of observation.pageErrors) {
    failures.push(`uncaught error on load: ${error}`);
  }

  // ---- initial load ----
  const eager = [...observation.requests.keys()].sort();
  /** @type {string[][]} */
  const rows = [];
  let total = { raw: 0, gzip: 0, gzipMin: 0, brotli: 0 };
  for (const name of eager) {
    const path = join(DATA_DIR, name);
    if (!existsSync(path)) {
      failures.push(`${name} is requested on load but missing from ${DATA_DIR} (404)`);
      continue;
    }
    const size = measure(readFileSync(path));
    total = {
      raw: total.raw + size.raw,
      gzip: total.gzip + size.gzip,
      gzipMin: total.gzipMin + size.gzipMin,
      brotli: total.brotli + size.brotli,
    };
    const hits = observation.requests.get(name) ?? 1;
    rows.push([
      name,
      kb(size.raw),
      kb(size.gzip),
      kb(size.brotli),
      hits > 1 ? `${hits}x` : "",
    ]);
  }
  rows.push(["", "", "", "", ""]);
  rows.push(["TOTAL", kb(total.raw), kb(total.gzip), kb(total.brotli), ""]);

  console.log(`initial load — ${eager.length} file(s), no user interaction`);
  console.log(table(rows, ["file", "raw", `gzip -${GZIP_LEVEL}`, "brotli", "reqs"]));
  console.log(
    `\nworst case, if the server compresses at gzip -1: ${kb(total.gzipMin)}`,
  );

  // ---- deferred ----
  const known = new Set(
    sites.filter((site) => site.target !== "" && !site.dynamic).map((s) => s.target),
  );
  const deferred = [...known].filter((name) => !observation.requests.has(name)).sort();
  if (deferred.length > 0) {
    /** @type {string[][]} */
    const later = [];
    for (const name of deferred) {
      const path = join(DATA_DIR, name);
      const size = existsSync(path) ? measure(readFileSync(path)) : null;
      const site = sites.find((s) => s.target === name);
      later.push([
        name,
        size ? kb(size.raw) : "absent",
        size ? kb(size.gzip) : "-",
        size ? kb(total.gzip + size.gzip) : "-",
        site ? `${site.file}:${site.line}` : "",
      ]);
    }
    console.log("\ndeferred — fetched on demand, not on initial load");
    console.log(
      table(later, ["file", "raw", `gzip -${GZIP_LEVEL}`, "total if eager", "fetched at"]),
    );
  }

  const dynamic = sites.filter((site) => site.dynamic);
  if (dynamic.length > 0) {
    console.log("\nper-term datasets, one file per request:");
    for (const site of dynamic) {
      console.log(`  ${site.file}:${site.line}  data/${site.target}`);
    }
  }

  // ---- verdict ----
  if (total.gzip > BUDGET_BYTES) {
    const over = total.gzip - BUDGET_BYTES;
    failures.push(
      `over budget by ${kb(over)}: ${kb(total.gzip)} gzipped on initial load, ceiling is ${BUDGET_KB} KB`,
    );
    const worst = [...rows]
      .filter((row) => row[0] !== "" && row[0] !== "TOTAL")
      .sort((a, b) => parseFloat(b[2]) - parseFloat(a[2]))
      .slice(0, 3);
    failures.push(
      `largest contributors: ${worst.map((row) => `${row[0]} (${row[2]})`).join(", ")}`,
    );
  }
  for (const site of unaccounted) {
    failures.push(
      `unrecognised network call at ${site.file}:${site.line} — this gate cannot ` +
        `account for it, so the measured total may be short: ${site.snippet}`,
    );
  }

  console.log("");
  if (failures.length > 0) {
    for (const failure of failures) console.log(`FAIL  ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `PASS  ${kb(total.gzip)} gzipped on initial load, ${kb(BUDGET_BYTES - total.gzip)} under the ${BUDGET_KB} KB budget`,
  );
}

await main();
