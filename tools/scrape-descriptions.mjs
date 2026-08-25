#!/usr/bin/env node
/**
 * Scrape undergraduate program descriptions from the Boğaziçi University
 * license catalog into public/data/descriptions.json.
 *
 * Flow: Lisans_Katalogu index page (department list) → per department
 * /tr/pages/lisans-programlari/<id> page (title, credits, ECTS,
 * description, prerequisite).
 *
 * Usage:
 *   node tools/scrape-descriptions.mjs [--dept <id>[,<id>…]] [--resume] [--dry-run]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import { parseCatalogDepartment, parseCatalogIndex } from "./lib/parse-descriptions.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = path.join(ROOT, "public", "data", "descriptions.json");
const CATALOG_HOME =
  "https://www.bogazici.edu.tr/tr-TR/Content/Akademik/Lisans_Katalogu";
const DEPT_URL = (id) => `https://www.bogazici.edu.tr/tr/pages/lisans-programlari/${id}`;
const THROTTLE_MS = 1_000;
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

function parseArgs(argv) {
  const args = { dept: null, resume: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dept") args.dept = argv[++i] ?? "";
    else if (argv[i] === "--resume") args.resume = true;
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Throttled fetch with retries (exponential backoff) and a hard timeout.
 * The site is served as UTF-8; do not let anything re-decode it otherwise.
 */
async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "boun-course-planner-bot/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await sleep(1_000 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message}`);
}

/** Politeness delay between consecutive requests to bogazici.edu.tr. */
async function throttle() {
  await sleep(THROTTLE_MS);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const existing = args.resume
    ? JSON.parse(await readFile(OUT_FILE, "utf8").catch(() => "{}"))
    : {};
  if (args.resume && Object.keys(existing).length > 0) {
    console.log(`Resuming: ${Object.keys(existing).length} departments already scraped`);
  }
  const results = { ...existing };

  console.log("Fetching catalog index…");
  const catalogHtml = await fetchText(CATALOG_HOME);
  const departments = parseCatalogIndex(catalogHtml);
  if (departments.length === 0) {
    throw new Error(
      `No departments found on ${CATALOG_HOME} — page format may have changed`,
    );
  }

  let targets = departments;
  if (args.dept) {
    const wantedIds = args.dept.split(",").map((d) => d.trim()).filter(Boolean);
    const known = new Map(departments.map((d) => [d.id, d]));
    const unknown = wantedIds.filter((id) => !known.has(id));
    if (unknown.length > 0) throw new Error(`Unknown department id(s): ${unknown.join(", ")}`);
    targets = wantedIds.map((id) => known.get(id));
  }
  console.log(`${targets.length} department(s) to scrape`);

  let fetched = 0;
  let failed = 0;
  for (const [index, dept] of targets.entries()) {
    await throttle();
    let courses;
    try {
      const html = await fetchText(DEPT_URL(dept.id));
      courses = parseCatalogDepartment(html);
    } catch (error) {
      failed++;
      console.warn(`[warn] ${dept.id} (${dept.name}): ${error.message}`);
      continue;
    }

    if (Object.keys(courses).length === 0) {
      console.warn(`[warn] ${dept.id} (${dept.name}): no courses parsed — skipping (format change?)`);
      continue;
    }

    // Same course code appearing in two departments: first department wins.
    for (const [code, info] of Object.entries(courses)) {
      if (code in results) {
        console.warn(`[warn] duplicate course code ${code} in ${dept.id}: keeping earlier entry`);
        continue;
      }
      results[code] = info;
    }
    fetched += Object.keys(courses).length;
    console.log(`[${index + 1}/${targets.length}] ${dept.name}: ${Object.keys(courses).length} courses`);
  }

  const output = JSON.stringify(results, null, 2) + "\n";
  const current = await readFile(OUT_FILE, "utf8").catch(() => null);

  if (args.dryRun) {
    console.log(
      `Dry run: would write ${Object.keys(results).length} entries to public/data/descriptions.json` +
        ` (${fetched} fetched this run${failed ? `, ${failed} failed` : ""})`,
    );
  } else if (output === current) {
    console.log("already up to date");
  } else {
    await writeFile(OUT_FILE, output);
    console.log(
      `Done: ${Object.keys(results).length} entries written to public/data/descriptions.json` +
        ` (${fetched} fetched this run${failed ? `, ${failed} failed` : ""})`,
    );
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
