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
 * FILE SHAPE. The output is a map of base course code → prerequisite record,
 * plus one reserved "meta" key:
 *
 *   {
 *     "meta": { "scrapedAt": ISO, "courses": 6937, "failed": 0 },
 *     "ACL122": { "prereqs": [], "coreqs": [], "consent": false, "gpa": null },
 *     …
 *   }
 *
 * The point of `meta` is to make three states distinguishable, which the old
 * shape could not do:
 *
 *   scraped, has prerequisites → entry present, prereqs.length > 0
 *   scraped, has none          → entry present, prereqs.length === 0
 *   never scraped              → NO ENTRY (314 of the 1324 courses offered in
 *                                2026-2027-1 are in this state)
 *
 * That works only if key-presence really means "we read the page", which is
 * what `isPrereqPage` now guarantees: a course whose page is an error body, a
 * session-expired redirect or anything else that is not a prerequisitecheck.asp
 * answer is counted in `meta.failed` and deliberately left out of the file,
 * instead of being written as an all-empty record indistinguishable from a
 * genuine "no prerequisite". `meta.scrapedAt` says when that guarantee was
 * last refreshed.
 *
 * UI CONSEQUENCE (owned by a later wave, not by this file): a course with no
 * entry must be shown as "no data", never as "Eligible". src/lib/eligibility.mjs
 * already returns status "no-data" for a missing entry; what must not happen is
 * a consumer treating `prereqs: []` and "absent" as the same thing.
 *
 * "meta" is a safe reserved key because a course code always contains digits
 * (see normalizeCourseCode), so it can never collide with a real entry. The one
 * consumer that iterates keys, src/lib/roadmapLogic.mjs, only uses them as a
 * membership set tested against course codes, so the extra member is inert.
 *
 * Usage:
 *   node tools/scrape-prereqs.mjs [--dept CMPE,AD] [--out FILE] [--resume]
 *   node tools/scrape-prereqs.mjs --rebuild-meta   add/refresh meta in place
 */

import { readFile, writeFile } from "node:fs/promises";

import { fetchPage } from "./lib/http.mjs";
import {
  derivePrereqsMeta,
  isPrereqPage,
  parseCourseList,
  parseDepartmentCodes,
  parsePrereqPage,
  serializePrereqsFile,
  splitPrereqsFile,
} from "./lib/parse-prereqs.mjs";

const DEFAULT_OUT = "public/data/prereqs.json";
const THROTTLE_MS = 500;

function parseArgs(argv) {
  const args = { dept: null, out: DEFAULT_OUT, resume: false, rebuildMeta: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dept") args.dept = argv[++i] ?? "";
    else if (argv[i] === "--out") args.out = argv[++i] ?? DEFAULT_OUT;
    else if (argv[i] === "--resume") args.resume = true;
    else if (argv[i] === "--rebuild-meta") args.rebuildMeta = true;
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


async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.rebuildMeta) {
    const { meta, courses } = splitPrereqsFile(JSON.parse(await readFile(args.out, "utf8")));
    const count = Object.keys(courses).length;
    if (count === 0) throw new Error(`${args.out} has no course entries — refusing to rewrite`);
    await writeFile(args.out, serializePrereqsFile(courses, derivePrereqsMeta()));
    console.log(
      `${args.out}: meta ${meta ? "refreshed" : "added"} for ${count} courses` +
        " (derived: entry-presence is the scraped set, timestamps are not recoverable)",
    );
    return;
  }

  const throttledFetch = makeThrottledFetch();

  const stored = args.resume
    ? splitPrereqsFile(JSON.parse(await readFile(args.out, "utf8").catch(() => "{}")))
    : { meta: null, courses: {} };
  if (args.resume && Object.keys(stored.courses).length > 0) {
    console.log(`Resuming: ${Object.keys(stored.courses).length} courses already scraped`);
  }
  const results = { ...stored.courses };

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
  // Only a full crawl re-verifies every course, so only a full crawl may claim
  // a fresh scrapedAt. A --dept run adds courses and inherits the old stamp
  // (and its `derived` flag, if the file's meta was migrated rather than
  // crawled), because most of the file was not re-read.
  const startedAt = new Date().toISOString();
  const scopedRun = Boolean(args.dept);
  const baseMeta = scopedRun && stored.meta?.scrapedAt
    ? { scrapedAt: stored.meta.scrapedAt, ...(stored.meta.derived ? { derived: true } : {}) }
    : { scrapedAt: startedAt };
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
        // Leaving the course out is the whole point: an unusable page must not
        // become a record that reads as "this course has no prerequisites".
        if (!isPrereqPage(page)) {
          failed++;
          console.warn(`[warn] ${dept} ${key}: not a prerequisite page — not recorded`);
          continue;
        }
        results[key] = parsePrereqPage(page);
        fetched++;
      } catch (error) {
        failed++;
        console.warn(`[warn] ${dept} ${key}: ${error.message}`);
      }
    }

    // Persist after every department so a killed run loses little progress.
    await writeFile(args.out, serializePrereqsFile(results, { ...baseMeta, failed }));
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
