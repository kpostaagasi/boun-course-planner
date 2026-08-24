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
 * Parse one prerequisitecheck.asp page.
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
