#!/usr/bin/env node
/**
 * Scrape live per-section quotas from registration.boun.edu.tr into
 * public/data/quota.json.
 *
 * The schedule pages carry no quota text at all — only a JS link to
 * /scripts/quotasearch.asp — so this is one request per section (~2900 for a
 * full term) and takes roughly 25 minutes at the throttle below. The section
 * list is derived from the already-scraped public/data/<term>.json rather than
 * re-crawling the schedule: run tools/scrape.mjs first.
 *
 * Modes:
 *   node tools/scrape-quota.mjs --semester 2026/2027-1
 *   node tools/scrape-quota.mjs --semester 2026/2027-1 --limit 10   cheap smoke run
 *   node tools/scrape-quota.mjs --semester 2026/2027-1 --resume     skip sections already in the output
 *   node tools/scrape-quota.mjs --semester 2026/2027-1 --dry-run    fetch + validate, never write
 *
 * Safety rules, mirroring tools/scrape.mjs:
 *   - Nothing is written unless the run validates: failure rate under a
 *     threshold, section count above a floor, and no suspicious shrink against
 *     the file already on disk.
 *   - Parse warnings (an unrecognised quota table, a non-numeric cell) are
 *     counted and abort the run past a threshold, so a BOUN layout change
 *     surfaces instead of zeroing out every section's enrolment.
 *   - --dump-unrecognised writes the raw HTML of any page that produced a
 *     warning to tools/lib/fixtures/ so it can become a real test fixture.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchPage } from "./lib/http.mjs";
import { parseQuotaPage } from "./lib/parse-quota.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "public", "data");
const FIXTURES_DIR = path.join(ROOT, "tools", "lib", "fixtures");
const OUT_FILE = path.join(DATA_DIR, "quota.json");

/** Politeness delay between quota requests. */
const THROTTLE_MS = 400;
/** Absolute floor of section records for a full run to be considered real. */
const MIN_SECTIONS = 100;
/** Share of requests allowed to fail before the run is treated as an outage. */
const MAX_FAILURE_RATIO = 0.05;
/** A refresh that loses more than this fraction of sections is treated as an outage. */
const MAX_SHRINK_RATIO = 0.5;
/** Parse warnings tolerated before the run is rejected. */
const MAX_WARNINGS = 20;

/**
 * Section keys look like "<DEPT><NUM>.<SECTION>", e.g. "CMPE150.01" or
 * "EC101.01". LAB / P.S. sub-rows are stored as "<key> LAB 1" and have no quota
 * cell of their own, so they are skipped by this pattern.
 */
const SECTION_KEY = /^([A-Z]+)\s*(\d{2,4}[A-Z0-9]*)\.(\d{2})$/;

const sleep = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @typedef {object} Options
 * @property {string} semester "YYYY/YYYY-T"
 * @property {boolean} dryRun
 * @property {boolean} resume
 * @property {boolean} dumpUnrecognised
 * @property {number | null} limit
 */

/**
 * @param {string[]} argv
 * @returns {Options}
 */
function parseArgs(argv) {
  /** @type {Options} */
  const options = {
    semester: "",
    dryRun: false,
    resume: false,
    dumpUnrecognised: false,
    limit: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--semester") options.semester = argv[++i] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++i]);
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--resume") options.resume = true;
    else if (arg === "--dump-unrecognised") options.dumpUnrecognised = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!/^\d{4}\/\d{4}-\d$/.test(options.semester)) {
    throw new Error('--semester is required, e.g. --semester 2026/2027-1');
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  return options;
}

/** "2026/2027-1" -> "2026-2027-1" */
function semesterFileKey(/** @type {string} */ donem) {
  return donem.replace("/", "-");
}

/**
 * Section keys of a scraped term, in the order the quota pages will be fetched.
 * @param {string} donem
 * @returns {Array<{key: string, abbr: string, code: string, section: string}>}
 */
function sectionsOf(donem) {
  const file = path.join(DATA_DIR, `${semesterFileKey(donem)}.json`);
  if (!existsSync(file)) {
    throw new Error(`${file} not found — run tools/scrape.mjs --semester ${donem} first`);
  }
  /** @type {Record<string, unknown>} */
  const term = JSON.parse(readFileSync(file, "utf8"));
  const targets = [];
  for (const key of Object.keys(term)) {
    const match = key.match(SECTION_KEY);
    if (!match) continue;
    targets.push({ key, abbr: match[1], code: match[2], section: match[3] });
  }
  if (targets.length === 0) {
    throw new Error(`${file} has no "<DEPT><NUM>.<SECTION>" keys — wrong file?`);
  }
  return targets;
}

/**
 * The stored form of one section. Empty `rows`/`surname` and a null `cap` are
 * omitted: over a full term that is the majority case, and dropping them keeps
 * quota.json an order of magnitude smaller than the semester files.
 * @typedef {object} StoredSection
 * @property {number} [cap]
 * @property {import("./lib/parse-quota.mjs").QuotaRow[]} [rows]
 * @property {import("./lib/parse-quota.mjs").SurnameRestriction[]} [surname]
 */

/**
 * @param {import("./lib/parse-quota.mjs").QuotaPage} page
 * @returns {StoredSection}
 */
function compact(page) {
  /** @type {StoredSection} */
  const stored = {};
  if (page.cap !== null) stored.cap = page.cap;
  if (page.rows.length > 0) stored.rows = page.rows;
  if (page.surname.length > 0) stored.surname = page.surname;
  return stored;
}

/**
 * @param {Record<string, StoredSection>} sections
 * @param {number} attempted
 * @param {number} failed
 * @param {boolean} partial true for a --limit smoke run: skip the size gates.
 */
function validate(sections, attempted, failed, partial) {
  const count = Object.keys(sections).length;
  if (count === 0) {
    throw new Error("no sections parsed — refusing to write");
  }
  if (attempted > 0 && failed / attempted > MAX_FAILURE_RATIO) {
    throw new Error(
      `${failed}/${attempted} quota pages failed (max ${(MAX_FAILURE_RATIO * 100).toFixed(0)}%)` +
        " — source site likely broken",
    );
  }
  if (partial) return;

  if (count < MIN_SECTIONS) {
    throw new Error(`only ${count} sections parsed (min ${MIN_SECTIONS})`);
  }
  // Every real page states a capacity; a term where almost none do means the
  // capacity label moved and every record is junk.
  const withCap = Object.values(sections).filter((s) => typeof s.cap === "number").length;
  if (withCap / count < 0.5) {
    throw new Error(
      `only ${withCap}/${count} sections have a capacity — quotasearch.asp layout changed`,
    );
  }
  if (existsSync(OUT_FILE)) {
    const previous = JSON.parse(readFileSync(OUT_FILE, "utf8"));
    const previousCount = Object.keys(previous.sections ?? {}).length;
    if (count < previousCount * MAX_SHRINK_RATIO) {
      throw new Error(
        `section count dropped ${previousCount} -> ${count}; source site likely broken`,
      );
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const targets = sectionsOf(options.semester);

  /** @type {Record<string, StoredSection>} */
  let sections = {};
  if (options.resume && existsSync(OUT_FILE)) {
    const previous = JSON.parse(readFileSync(OUT_FILE, "utf8"));
    if (previous.meta?.term === options.semester) {
      sections = previous.sections ?? {};
      console.log(`Resuming: ${Object.keys(sections).length} sections already in quota.json`);
    } else {
      console.log(
        `Not resuming: quota.json holds ${previous.meta?.term ?? "?"}, not ${options.semester}`,
      );
    }
  }

  const queue = targets.filter((t) => !(t.key in sections));
  const planned = options.limit === null ? queue : queue.slice(0, options.limit);
  console.log(
    `${options.semester}: ${targets.length} sections, ${planned.length} to fetch` +
      `${options.limit === null ? "" : ` (--limit ${options.limit})`}…`,
  );

  /** @type {string[]} */
  const warnings = [];
  let failed = 0;
  let done = 0;

  for (const { key, abbr, code, section } of planned) {
    await sleep(THROTTLE_MS);
    let html;
    try {
      html = await fetchPage("/scripts/quotasearch.asp", {
        abbr,
        code,
        section,
        donem: options.semester,
      });
    } catch (error) {
      failed++;
      console.warn(`  [fail] ${key}: ${error instanceof Error ? error.message : error}`);
      continue;
    }

    let page;
    try {
      page = parseQuotaPage(html, key);
    } catch (error) {
      // A parse throw is a layout change, not a flaky request: stop at once
      // rather than grinding through 2900 pages producing nothing.
      if (options.dumpUnrecognised) dumpHtml(key, html);
      throw error;
    }
    if (page.warnings.length > 0 && options.dumpUnrecognised) dumpHtml(key, html);
    warnings.push(...page.warnings);
    sections[key] = compact(page);

    done++;
    if (done % 100 === 0) {
      console.log(`  ${done}/${planned.length} fetched (${failed} failed)`);
    }
  }

  for (const warning of warnings.slice(0, MAX_WARNINGS)) console.warn(`  warning: ${warning}`);
  if (warnings.length > MAX_WARNINGS) {
    throw new Error(`${warnings.length} parse warnings (max ${MAX_WARNINGS})`);
  }

  const partial = options.limit !== null || planned.length < queue.length;
  validate(sections, planned.length, failed, partial);

  const output = {
    meta: { term: options.semester, scrapedAt: new Date().toISOString() },
    sections: Object.fromEntries(Object.entries(sections).sort(([a], [b]) => a.localeCompare(b))),
  };

  if (options.dryRun) {
    console.log(
      `Dry run: ${Object.keys(sections).length} sections, ` +
        `${JSON.stringify(output).length} bytes — nothing written.`,
    );
    return;
  }

  writeFileSync(OUT_FILE, JSON.stringify(output) + "\n");
  console.log(
    `quota.json: written (${Object.keys(sections).length} sections, ${failed} failed,` +
      ` ${warnings.length} warnings)`,
  );
}

/**
 * Persist a page whose parse produced a warning so it can become a fixture.
 * @param {string} key
 * @param {string} html
 */
function dumpHtml(key, html) {
  mkdirSync(FIXTURES_DIR, { recursive: true });
  const file = path.join(
    FIXTURES_DIR,
    `quotasearch-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`,
  );
  writeFileSync(file, html);
  console.warn(`  [dump] ${file}`);
}

main().catch((error) => {
  console.error(`QUOTA SCRAPER FAILED: ${error.message}`);
  process.exit(1);
});
