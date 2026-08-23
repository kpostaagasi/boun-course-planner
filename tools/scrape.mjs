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


import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { fetchSchedule, fetchPage } from "./lib/http.mjs";
import { parseDepartmentList, parseSchedulePage } from "./lib/parse.mjs";
import { candidateSemesters, discoverSemesters, semestersToSync } from "./lib/semesters.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "public", "data");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
function optionValues(flag) {
  const values = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) values.push(args[i + 1]);
  }
  return values;
}
const forcedSemesters = optionValues("--semester").filter(Boolean);

/** Absolute floor of parsed sections for a semester to be considered real. */
const MIN_SECTIONS = 50;
/** A refresh that loses more than this fraction of sections is treated as an outage. */
const MAX_SHRINK_RATIO = 0.5;
/** Parse warnings tolerated before a scrape is rejected. */
const MAX_WARNINGS = 20;

function semesterFileKey(donem) {
  // "2025/2026-1" -> "2025-2026-1"
  return donem.replace("/", "-");
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

  for (const dept of departments) {
    const html = await fetchSchedule(donem, dept.kisaadi, dept.bolum);
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
  const semesters = forcedSemesters.length > 0 ? published : semestersToSync(published);
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

  // Academic-calendar dates are not scrapeable reliably; warn so humans can add them.
  const datesFile = "semester-dates.json";
  if (existingFiles.has(datesFile)) {
    const dates = readJson(datesFile);
    for (const donem of semesters) {
      if (!(semesterFileKey(donem) in dates)) {
        console.warn(
          `NOTE: ${datesFile} has no entry for ${semesterFileKey(donem)} ` +
            "(calendar export disabled until added manually)",
        );
      }
    }
  }

  if (changed.length === 0) {
    console.log("Everything already up to date.");
  } else {
    console.log(`Changed files: ${changed.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(`SCRAPER FAILED: ${error.message}`);
  process.exit(1);
});
