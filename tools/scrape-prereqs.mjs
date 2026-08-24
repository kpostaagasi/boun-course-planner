#!/usr/bin/env node
/**
 * Scrape course prerequisites from registration.boun.edu.tr into
 * public/data/prereqs.json.
 *
 * Flow: ectsdepsel.asp (department list) → per department ects.asp?bolum=X
 * (course catalogue) → per course prerequisitecheck.asp?abbr=A&code=C.
 *
 * The full crawl is several thousand requests at 500 ms throttle, so it takes
 * hours; --resume skips courses already present in the output file and the
 * file is rewritten after every department, so an interrupted run can simply
 * be restarted with the same flags.
 *
 * Usage:
 *   node tools/scrape-prereqs.mjs [--dept CMPE,AD] [--out public/data/prereqs.json] [--resume]
 */

import { readFile, writeFile } from "node:fs/promises";

import { fetchPage } from "./lib/http.mjs";
import {
  parseCourseList,
  parseDepartmentCodes,
  parsePrereqPage,
} from "./lib/parse-prereqs.mjs";

const DEFAULT_OUT = "public/data/prereqs.json";
const THROTTLE_MS = 500;

function parseArgs(argv) {
  const args = { dept: null, out: DEFAULT_OUT, resume: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dept") args.dept = argv[++i] ?? "";
    else if (argv[i] === "--out") args.out = argv[++i] ?? DEFAULT_OUT;
    else if (argv[i] === "--resume") args.resume = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Throttled fetch: keep ≥THROTTLE_MS between requests to the site. */
function makeThrottledFetch() {
  let lastRequestAt = 0;
  return async function throttledFetch(path, params) {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < THROTTLE_MS) await sleep(THROTTLE_MS - elapsed);
    lastRequestAt = Date.now();
    return fetchPage(path, params);
  };
}

function sortedJson(data) {
  return JSON.stringify(Object.fromEntries(Object.entries(data).sort()), null, 2) + "\n";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const throttledFetch = makeThrottledFetch();

  const existing = args.resume
    ? JSON.parse(await readFile(args.out, "utf8").catch(() => "{}"))
    : {};
  if (args.resume && Object.keys(existing).length > 0) {
    console.log(`Resuming: ${Object.keys(existing).length} courses already scraped`);
  }
  const results = { ...existing };

  console.log("Fetching department list…");
  const departments = parseDepartmentCodes(await throttledFetch("/scripts/ectsdepsel.asp"));
  if (departments.length === 0) {
    throw new Error("No departments found on ectsdepsel.asp — page format may have changed");
  }

  let targets = departments;
  if (args.dept) {
    const wanted = args.dept.split(",").map((d) => d.trim().toUpperCase()).filter(Boolean);
    const unknown = wanted.filter((d) => !departments.includes(d));
    if (unknown.length > 0) throw new Error(`Unknown department code(s): ${unknown.join(", ")}`);
    targets = wanted;
  }
  console.log(`${targets.length} department(s) to scrape`);

  let fetched = 0;
  let failed = 0;
  for (const [index, dept] of targets.entries()) {
    const html = await throttledFetch("/scripts/ects.asp", { bolum: dept });
    const courses = parseCourseList(html);
    if (courses.length === 0) {
      console.warn(`[warn] ${dept}: no courses parsed — skipping (format change?)`);
      continue;
    }

    for (const { abbr, code } of courses) {
      const key = `${abbr}${code}`;
      if (key in results) continue;
      try {
        const page = await throttledFetch("/scripts/prerequisitecheck.asp", {
          abbr,
          code,
        });
        results[key] = parsePrereqPage(page);
        fetched++;
      } catch (error) {
        failed++;
        console.warn(`[warn] ${dept} ${key}: ${error.message}`);
      }
    }

    // Persist after every department so a killed run loses little progress.
    await writeFile(args.out, sortedJson(results));
    console.log(`[${index + 1}/${targets.length}] ${dept}: ${courses.length} courses`);
  }

  console.log(
    `Done: ${Object.keys(results).length} courses in ${args.out}` +
      ` (${fetched} fetched this run${failed ? `, ${failed} failed` : ""})`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
