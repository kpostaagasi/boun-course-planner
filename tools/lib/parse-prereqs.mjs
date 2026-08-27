/**
 * Parsers for the prerequisite-check endpoints on registration.boun.edu.tr.
 *
 * Pages are classic ASP tables in ISO-8859-9-decoded HTML (decoding happens in
 * http.mjs). A prerequisitecheck.asp answer has three sections:
 *
 *   1. "Course Prerequisites"  — rows of <Course, Prerequisite> pairs
 *   2. GPA / Senior / Junior / Consent of Instructor table
 *   3. "Corequisites"          — same row structure as section 1
 *
 * A section with no data contains the marker
 * `<center><u>This Type of Prerequisite not Found</u></center>`.
 *
 * This module also owns the shape of public/data/prereqs.json itself
 * (`serializePrereqsFile` / `splitPrereqsFile` / `derivePrereqsMeta`), so the
 * schema and its invariants live next to the parser that produces it and stay
 * testable without touching the network. See scrape-prereqs.mjs for the
 * rationale behind the reserved "meta" key.
 */

import * as cheerio from "cheerio";

// Course codes are inconsistent ("EC  203", "CHEM105", "BM 4101"); most codes
// are three digits but a few departments use four. The suffix letter covers
// codes like "MATH101L"-style variants seen in the wild.
const COURSE_CODE = /^[A-Z]+\s*\d{3,4}[A-Z]?$/;

const NOT_FOUND = /This Type of Prerequisite not Found/i;
/** Normalize a raw course-code cell ("EC  101;" → "EC101"), or null if it is not a code. */
export function normalizeCourseCode(raw) {
  const text = String(raw ?? "")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[^A-Z0-9\s]/gi, " ")
    .trim()
    .toUpperCase();
  if (!COURSE_CODE.test(text)) return null;
  return text.replace(/\s+/g, "");
}

function cellText($, element) {
  return $(element).text().replace(/\u00a0/g, " ").trim();
}

/** Split page HTML into the three logical sections by their heading markers. */
function splitSections(html) {
  const match = (re) => {
    const m = html.match(re);
    return m ? m.index : -1;
  };
  const preStart = match(/Course\s*Prerequisites\s*:/i);
  const gpaStart = match(/GPA,\s*Being\s*Senior/i);
  const coreqStart = match(/Corequisites\s*:/i);

  return {
    prereqs: html.slice(preStart, gpaStart === -1 ? undefined : gpaStart),
    gpa: gpaStart === -1 ? "" : html.slice(gpaStart, coreqStart === -1 ? undefined : coreqStart),
    coreqs: coreqStart === -1 ? "" : html.slice(coreqStart),
  };
}

/**
 * Collect the second-column course codes of every data row in the
 * Course-Prerequisites / Corequisites style tables.
 */
function parseReqTable(html) {
  if (!html || NOT_FOUND.test(html)) return [];
  const $ = cheerio.load(html);
  const found = [];
  for (const tr of $("tr").toArray()) {
    const cells = $(tr).children("td");
    if (cells.length < 2) continue;
    // Column layout: [queried course, requirement]. Header cells ("Prerequisite")
    // fail the code regex and are dropped by normalizeCourseCode.
    const code = normalizeCourseCode(cellText($, cells.get(1)));
    if (code && !found.includes(code)) found.push(code);
  }
  return found;
}

/** Parse the GPA/Senior/Junior/Consent table; null when absent or "not Found". */
function parseConsentTable(html) {
  if (!html || NOT_FOUND.test(html)) return { consent: false, gpa: null };
  const $ = cheerio.load(html);
  let consent = false;
  let gpa = null;
  for (const tr of $("tr").toArray()) {
    const cells = $(tr)
      .children("td")
      .toArray()
      .map((td) => cellText($, td));
    if (cells.length < 6) continue; // header row has no course cell either
    if (!normalizeCourseCode(cells[0])) continue;
    // Columns: Course | GPA Limit | To Be Senior | To Be Junior | AND | OR
    if (cells[4] === "YES" || cells[5] === "YES") consent = true;
    const limit = Number.parseFloat(cells[1]);
    if (Number.isFinite(limit) && limit > 0 && gpa === null) {
      gpa = limit.toFixed(2);
    }
  }
  return { consent, gpa };
}

/**
 * Is this really a prerequisitecheck.asp answer?
 *
 * `parsePrereqPage` degrades gracefully: given an error page, a session-expired
 * redirect or any other 200-with-garbage body it finds none of the three
 * section markers and returns `{prereqs: [], coreqs: [], consent: false,
 * gpa: null}` — byte-identical to a course that genuinely has no prerequisite.
 * That made "no prerequisite" and "we never actually read the page"
 * indistinguishable in prereqs.json, so the crawler asks this first and simply
 * does not record a course whose page fails the check. Every key in
 * prereqs.json is therefore a course whose page we really parsed, and a course
 * absent from the file has UNKNOWN prerequisites.
 *
 * All three markers are required: the real pages all carry all three, including
 * the fully-empty CMPE150 answer where every section says "This Type of
 * Prerequisite not Found" (see tools/lib/fixtures/prerequisitecheck-*.html). If
 * BOUN ever stops emitting one, the crawler rejects everything at once and the
 * run fails loudly instead of quietly wiping the file.
 *
 * @param {string} html decoded page HTML
 * @returns {boolean}
 */
export function isPrereqPage(html) {
  return (
    /Course\s*Prerequisites\s*:/i.test(html) &&
    /GPA,\s*Being\s*Senior/i.test(html) &&
    /Corequisites\s*:/i.test(html)
  );
}

/**
 * Parse one prerequisitecheck.asp page. Call `isPrereqPage` first: this
 * function is deliberately lenient and will happily report "no prerequisites"
 * for a page that is not a prerequisite page at all.
 *
 * `gpa` is null in all 6937 entries of the current prereqs.json. It is KEPT,
 * not dropped, because:
 *   - the extraction works and is pinned by a test against real consent-table
 *     markup ("first positive GPA limit wins"), so null means BOUN's catalogue
 *     currently sets no GPA limit anywhere, not that the code is dead;
 *   - Course.svelte reads and renders it, and its TypeScript type lives in
 *     globalState.svelte.ts, so removing the field is a frontend change rather
 *     than a data one;
 *   - it is nearly free: dropping "gpa": null from every entry shrinks the file
 *     by 118 KB raw but only 236 bytes gzipped (24179 -> 23943 at level 9),
 *     because the repeated literal compresses away.
 *
 * @param {string} html decoded page HTML
 * @returns {{ prereqs: string[], coreqs: string[], consent: boolean, gpa: string | null }}
 */
export function parsePrereqPage(html) {
  const sections = splitSections(html);
  const { consent, gpa } = parseConsentTable(sections.gpa);
  return {
    prereqs: parseReqTable(sections.prereqs),
    coreqs: parseReqTable(sections.coreqs),
    consent,
    gpa,
  };
}

/**
 * Parse an ects.asp?bolum=DEPT course catalogue into [{abbr, code}] pairs,
 * e.g. "CMPE100" → {abbr: "CMPE", code: "100"}, "BM 4101" → {abbr: "BM", code: "4101"}.
 * Cross-listed duplicates keep their first occurrence.
 */
export function parseCourseList(html) {
  const $ = cheerio.load(html);
  const courses = [];
  const seen = new Set();
  for (const tr of $("tr").toArray()) {
    const firstCell = $(tr).children("td").first();
    if (!firstCell.length) continue;
    const match = cellText($, firstCell).match(/^([A-Z]+)\s*(\d{3,4}[A-Z]?)$/);
    if (!match) continue;
    const key = `${match[1]}${match[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    courses.push({ abbr: match[1], code: match[2] });
  }
  return courses;
}

/**
 * Parse ectsdepsel.asp into department codes (the bolum= values of its links).
 */
export function parseDepartmentCodes(html) {
  const $ = cheerio.load(html);
  const codes = [];
  for (const anchor of $("a[href*='ects.asp']").toArray()) {
    const href = anchor.attribs.href ?? "";
    const bolum = new URLSearchParams(
      href.slice(href.indexOf("?") + 1).replace(/&amp;/g, "&"),
    ).get("bolum");
    if (bolum && !codes.includes(bolum)) codes.push(bolum);
  }
  return codes;
}

/**
 * Reserved top-level key of public/data/prereqs.json. Safe because a course
 * code always contains digits (see COURSE_CODE), so it can never collide.
 */
export const PREREQS_META_KEY = "meta";

/**
 * @typedef {object} PrereqsMeta
 * @property {string} scrapedAt ISO timestamp of the crawl that produced the file
 * @property {number} failed courses attempted but deliberately not recorded
 * @property {number} courses number of course entries in the file
 * @property {true} [derived] set when the block was migrated onto a pre-existing
 *   file rather than written by a crawl, so `scrapedAt` is the migration time
 */

/**
 * Serialize course records plus the meta block. "meta" is written first so the
 * file reads as metadata-then-data; course keys stay sorted as before.
 * @param {Record<string, unknown>} courses records, without any meta key
 * @param {{scrapedAt: string, failed: number, derived?: boolean}} meta
 * @returns {string} JSON text, newline-terminated
 */
export function serializePrereqsFile(courses, meta) {
  const ordered = {
    [PREREQS_META_KEY]: { ...meta, courses: Object.keys(courses).length },
    ...Object.fromEntries(Object.entries(courses).sort()),
  };
  return JSON.stringify(ordered, null, 2) + "\n";
}

/**
 * Split a loaded prereqs.json into its meta block and its course records.
 * `meta` is null for a file written before the block existed.
 * @param {Record<string, unknown>} stored
 * @returns {{meta: PrereqsMeta | null, courses: Record<string, unknown>}}
 */
export function splitPrereqsFile(stored) {
  const { [PREREQS_META_KEY]: meta, ...courses } = stored;
  return { meta: /** @type {PrereqsMeta | null} */ (meta ?? null), courses };
}

/**
 * Derive a meta block for a file that predates it.
 *
 * Honest about its limitation: every entry already in the file was written by a
 * successful `parsePrereqPage` call, so treating the existing key set as the
 * scraped set is sound — that is exactly the invariant the crawler enforces.
 * What cannot be recovered is WHEN each course was fetched, or how many courses
 * failed during those old runs, so `scrapedAt` is the migration time, `failed`
 * is 0, and `derived: true` marks the block as not a real crawl result.
 * @returns {{scrapedAt: string, failed: number, derived: true}}
 */
export function derivePrereqsMeta() {
  return { scrapedAt: new Date().toISOString(), failed: 0, derived: true };
}
