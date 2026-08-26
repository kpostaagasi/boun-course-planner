#!/usr/bin/env node
/**
 * Scrape course schedules from registration.boun.edu.tr into public/data/.
 *
 * Modes:
 *   node tools/scrape.mjs                 discover published semesters and sync all
 *   node tools/scrape.mjs --semester 2026/2027-1 [--semester 2026/2027-2]
 *   node tools/scrape.mjs --dry-run       scrape + validate but never write
 *
 * Safety rules:
 *   - Nothing is written unless a full scrape succeeds: every department page
 *     fetched, parse warnings under a threshold, section counts sanity-checked.
 *   - Existing files are overwritten only when content actually changes.
 */


import { readdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { fetchSchedule, fetchPage } from "./lib/http.mjs";
import { parseDepartmentList, parseSchedulePage } from "./lib/parse.mjs";
import { candidateSemesters, discoverSemesters, semestersToSync } from "./lib/semesters.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "public", "data");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
/** Only usable with --semester: tolerate server-broken departments on archived terms. */
const ALLOW_PARTIAL = args.includes("--allow-partial");
function optionValues(flag) {
  const values = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) values.push(args[i + 1]);
  }
  return values;
}
const forcedSemesters = optionValues("--semester").filter(Boolean);
if (ALLOW_PARTIAL && forcedSemesters.length === 0) {
  console.error("--allow-partial requires an explicit --semester (never applies to auto-synced terms)");
  process.exit(1);
}
/** Absolute floor of parsed sections for a semester to be considered real. */
const MIN_SECTIONS = 50;
/** A refresh that loses more than this fraction of sections is treated as an outage. */
const MAX_SHRINK_RATIO = 0.5;
/** Parse warnings tolerated before a scrape is rejected. */
const MAX_WARNINGS = 20;

/** Politeness delay between department requests to avoid tripping the site's rate limiter. */
const DEPT_DELAY_MS = 1_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function semesterFileKey(donem) {
  // "2025/2026-1" -> "2025-2026-1"
  return donem.replace("/", "-");
}

/** Freshness timestamps ("YYYY-YYYY-T" -> ISO date) for data written this run. */
function touchMeta(donem) {
  const file = path.join(DATA_DIR, "meta.json");
  const meta = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  meta[semesterFileKey(donem)] = new Date().toISOString();
  writeFileSync(file, JSON.stringify(meta, null, 4) + "\n");
}

function readJson(file) {
  return JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf8"));
}

async function fetchDepartments() {
  const html = await fetchPage("/scripts/schdepsel.asp");
  const departments = parseDepartmentList(html);
  if (departments.length < 30) {
    throw new Error(
      `Department list looks broken (${departments.length} entries) — refusing to continue`,
    );
  }
  return departments;
}

async function scrapeSemester(donem, departments) {
  console.log(`Scraping ${donem} across ${departments.length} departments…`);
  const merged = new Map();
  const warnings = [];
  // In --allow-partial mode, departments that fail get one more pass after a
  // cool-down: transient rate-limits recover, server-broken pages do not.
  let queue = [...departments];
  const maxPasses = ALLOW_PARTIAL ? 2 : 1;
  const broken = [];

  for (let pass = 0; pass < maxPasses && queue.length > 0; pass++) {
    if (pass > 0) {
      console.warn(
        `  PARTIAL: retrying ${queue.map((d) => d.kisaadi).join(", ")} after cooldown…`,
      );
      await sleep(60_000);
    }

    const stillBroken = [];
    for (const dept of queue) {
      await sleep(DEPT_DELAY_MS);
      let html;
      try {
        html = await fetchSchedule(donem, dept.kisaadi, dept.bolum);
      } catch (error) {
        if (!ALLOW_PARTIAL) throw error;
        stillBroken.push(dept);
        console.warn(`  PARTIAL: ${dept.kisaadi} failed (${error.message})`);
        continue;
      }
      const { sections, warnings: rowWarnings } = parseSchedulePage(html, dept);
      warnings.push(...rowWarnings.map((w) => `${dept.kisaadi}: ${w}`));

      for (const [key, { entry }] of sections) {
        const prior = merged.get(key);
        if (!prior) {
          merged.set(key, entry);
        } else if (Array.isArray(prior.dept)) {
          // Cross-listed section seen from another department page: keep the
          // first schedule, accumulate department codes.
          for (const d of entry.dept ?? []) {
            if (!prior.dept.includes(d)) prior.dept.push(d);
          }
        }
      }
    }
    broken.push(...stillBroken.filter((d) => !broken.includes(d)).map((d) => d.kisaadi));
    queue = stillBroken;
  }

  if (ALLOW_PARTIAL && broken.length > 0) {
    const coverage = 1 - broken.length / departments.length;
    if (coverage < 0.95) {
      throw new Error(
        `${donem}: only ${(coverage * 100).toFixed(1)}% of departments succeeded (< 95%)`,
      );
    }
    console.warn(`  PARTIAL: ${donem} will be written without ${broken.join(", ")}`);
  }

  if (warnings.length > MAX_WARNINGS) {
    throw new Error(`${donem}: ${warnings.length} parse warnings (max ${MAX_WARNINGS})`);
  }

  const output = {};
  for (const key of [...merged.keys()].sort()) {
    const entry = merged.get(key);
    if (!entry.dept?.length) delete entry.dept;
    output[key] = entry;
  }

  validateSemester(donem, output);
  for (const w of warnings) console.warn(`  warning: ${w}`);
  return output;
}

function validateSemester(donem, courses) {
  const count = Object.keys(courses).length;
  if (count < MIN_SECTIONS) {
    throw new Error(`${donem}: only ${count} sections parsed (min ${MIN_SECTIONS})`);
  }

  let wellFormed = 0;
  const codePattern = /^[A-Z]{2,4}\d{2}[A-Z0-9]?(\.\d{2})?/;
  for (const [key, entry] of Object.entries(courses)) {
    if (codePattern.test(key) && typeof entry.name === "string") wellFormed++;
  }
  const ratio = wellFormed / count;
  if (ratio < 0.95) {
    throw new Error(`${donem}: only ${(ratio * 100).toFixed(1)}% of keys look like course codes`);
  }

  const previousPath = path.join(DATA_DIR, `${semesterFileKey(donem)}.json`);
  if (existsSync(previousPath)) {
    const previousCount = Object.keys(JSON.parse(readFileSync(previousPath, "utf8"))).length;
    if (count < previousCount * MAX_SHRINK_RATIO) {
      throw new Error(
        `${donem}: section count dropped ${previousCount} -> ${count}; source site likely broken`,
      );
    }
  }
}

async function main() {
  console.log("Discovering published semesters…");
  const published = await discoverSemesters(forcedSemesters);
  if (published.length === 0) {
    console.log("No published semester found among candidates:", candidateSemesters().join(", "));
    process.exitCode = 1;
    return;
  }
  const semesters =
    forcedSemesters.length > 0
      ? forcedSemesters.filter((donem) => published.includes(donem))
      : semestersToSync(published);
  if (semesters.length === 0) {
    console.error(`None of the forced semesters are published: ${forcedSemesters.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Published: ${published.join(", ")}`);
  console.log(`Syncing: ${semesters.join(", ")}`);

  const departments = await fetchDepartments();
  console.log(`Found ${departments.length} departments.`);

  const scraped = [];
  for (const donem of semesters) {
    scraped.push({ donem, courses: await scrapeSemester(donem, departments) });
  }

  if (DRY_RUN) {
    console.log("Dry run: no files written.");
    return;
  }

  const changed = [];
  const existingFiles = new Set(readdirSync(DATA_DIR));
  for (const { donem, courses } of scraped) {
    const file = `${semesterFileKey(donem)}.json`;
    const json = JSON.stringify(courses);
    const current = path.join(DATA_DIR, file);
    if (existingFiles.has(file) && readFileSync(current, "utf8") === json) {
      console.log(`  ${file}: unchanged`);
      continue;
    }
    writeFileSync(current, json);
    changed.push(file);
    touchMeta(donem);
    console.log(`  ${file}: written (${Object.keys(courses).length} sections)`);
  }

  // semesters.json lists every known term, newest first ("YYYY/YYYY-T").
  const listFile = "semesters.json";
  const known = existsSync(path.join(DATA_DIR, listFile)) ? readJson(listFile) : [];
  const allCodes = [...new Set([...semesters, ...known])].sort((a, b) => b.localeCompare(a));
  const newList = JSON.stringify(allCodes, null, 4) + "\n";
  if (JSON.stringify(known, null, 4) + "\n" !== newList) {
    writeFileSync(path.join(DATA_DIR, listFile), newList);
    changed.push(listFile);
    console.log(`  ${listFile}: updated -> ${allCodes.join(", ")}`);
  }

  // Academic-calendar dates are not scrapeable reliably; surface missing
  // entries so CI can open an issue and a human can add them.
  const datesFile = "semester-dates.json";
  const missingDates = [];
  if (existingFiles.has(datesFile)) {
    const dates = readJson(datesFile);
    for (const donem of semesters) {
      if (!(semesterFileKey(donem) in dates)) {
        missingDates.push(semesterFileKey(donem));
        console.warn(
          `NOTE: ${datesFile} has no entry for ${semesterFileKey(donem)} ` +
            "(calendar export disabled until added manually)",
        );
      }
    }
  }

  if (missingDates.length > 0 && process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `missing_dates=${missingDates.join(",")}\n`,
    );
  }

  // offerings.json: per-course term archive derived from all semester files.
  // Regenerated on every run so the frontend "offered when" badge stays fresh.
  const offeringsFile = path.join(DATA_DIR, "offerings.json");
  const offerings = {};
  for (const entry of existingFiles) {
    if (!/^\d{4}-\d{4}-\d\.json$/.test(entry)) continue;
    const termData = readJson(entry);
    for (const key of Object.keys(termData)) {
      const base = key.split(".")[0].replace(/\s+/g, "");
      const terms = (offerings[base] ??= new Set());
      terms.add(entry.replace(".json", ""));
    }
  }
  const out = {};
  for (const k of Object.keys(offerings)) out[k] = [...offerings[k]].sort();
  const offeringsJson = JSON.stringify(out) + "\n";
  if (
    !existsSync(offeringsFile) ||
    readFileSync(offeringsFile, "utf8") !== offeringsJson
  ) {
    writeFileSync(offeringsFile, offeringsJson);
    changed.push("offerings.json");
    console.log(
      `  offerings.json: written (${Object.keys(out).length} courses)`,
    );
  }

  if (changed.length === 0 && missingDates.length === 0) {
    console.log("Everything already up to date.");
  } else if (changed.length > 0) {
    console.log(`Changed files: ${changed.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(`SCRAPER FAILED: ${error.message}`);
  process.exit(1);
});
