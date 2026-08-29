/**
 * Parser for the per-section quota page on registration.boun.edu.tr.
 *
 * Endpoint: /scripts/quotasearch.asp?abbr=MATH&code=101&section=01&donem=YYYY/YYYY-T
 *
 * The schedule table's "Quota" cell carries no text, only a JS link:
 *   <a href="#" OnClick="javascript:showQuota('CMPE','101','01','2026/2027-1');">Info</a>
 * and the page defines
 *   function showQuota(ab,co,se,te) { window.open('quotasearch.asp?abbr='+ab+…) }
 * so the numbers live on a separate page that has to be fetched per section.
 *
 * Page anatomy (verified against the live 2026/2027-1 term):
 *
 *   <b>Max. Classroom Capacity:</b> 195
 *   <table BORDER="1">                       ← only rendered when rows exist
 *     <tr class="rectitle"><td …>Departmental Quotas:</td></tr>
 *     <tr class="title"><td>Department</td><td>Statu</td><td>Quota</td><td>Current</td></tr>
 *     <tr class="schtd"><td>ALL</td><td>ALL</td><td>100</td><td>134</td></tr>
 *   </table>
 *   <table BORDER="0"><TBODY><tr>            ← two degenerate, always-emitted
 *   <table BORDER="0"><TBODY><tr></tr>       ←   trailers with no rows
 *
 * The page heading promises "Departmental Quota(s), Class Quota(s), and Surname
 * Restriction(s), if any", and the two trailing empty tables are where those
 * two extra blocks would render. We scanned ~500 sections of 2026/2027-1 plus
 * samples of 2025/2026-2, 2025/2026-1 and 2021/2022-1 and found NO page that
 * emits either block, so their exact markup is unverified. Rather than invent a
 * fixture, tables are matched by their `tr.rectitle` caption and their columns
 * by their `tr.title` labels, and any captioned table we do not recognise is
 * reported through `warnings` so a real example surfaces in the scraper log
 * instead of being silently dropped. `parseQuotaPage` therefore returns
 * `surname: []` for every page we have actually seen.
 *
 * Failing loudly on layout change is deliberate and mirrors parse.mjs, but the
 * trigger is the per-section heading (see SECTION_HEADING), not the capacity
 * label: a page can legitimately carry no capacity and no tables at all. So a
 * BOUN HTML change breaks the run, while a genuinely empty section does not.
 *
 * One page shape carries no heading and is still not a layout change: the
 * registration system answers a section it does not know with
 *
 *   <!-- select ders,section from dersbilgileri … -->
 *   <center>No Such Course In This Semester...</center>
 *
 * under the normal "Quota Information" title. The schedule and the quota
 * database disagree more often than one would hope — BIO 403.02 is listed on
 * the 2026/2027-1 schedule page but absent from `dersbilgileri`, so a full-term
 * crawl hits this. Such a page is reported as `absent: true` rather than thrown
 * on, because a section that does not exist has no quota to record and must not
 * abort the other 2900 sections. Ruling out the "the query itself is wrong"
 * case (a bad term code makes *every* page look like this) is the caller's job:
 * see MAX_ABSENT_RATIO in tools/scrape-quota.mjs.
 */

import * as cheerio from "cheerio";

/**
 * One departmental- or class-quota row.
 *
 * `dept` and `status` are the raw cell texts ("ALL", a department code, a class
 * standing). `quota` is the allocation and `current` the live enrolled count,
 * so `current > quota` means the row is over-enrolled.
 *
 * The "Quota" cell is not always a number: AD251.05 in 2026/2027-1 serves
 * "Consent Of Instructor" there, i.e. the section has no numeric allocation and
 * registration is gated by the instructor instead. Such a row keeps
 * `quota: 0` — arithmetically true, so a consumer can still sum `quota` across
 * rows without special-casing — and carries the verbatim cell text in `note`.
 * `note` is absent on a plain numeric row.
 * @typedef {object} QuotaRow
 * @property {string} dept
 * @property {string} status
 * @property {number} quota
 * @property {number} current
 * @property {string} [note]
 */

/**
 * A surname restriction. Unverified shape — see the module comment: no sampled
 * page emits this block, so the field exists to keep the schema stable and is
 * always `[]` in practice.
 * @typedef {object} SurnameRestriction
 * @property {string} from
 * @property {string} to
 */

/**
 * @typedef {object} QuotaPage
 * @property {number | null} cap "Max. Classroom Capacity", null when the page
 *   states no capacity.
 * @property {QuotaRow[]} rows departmental + class quota rows, [] when none.
 * @property {SurnameRestriction[]} surname surname restrictions, [] when none.
 * @property {string[]} warnings non-fatal oddities the caller should escalate.
 * @property {boolean} absent true when the registration system does not know
 *   this section at all ("No Such Course In This Semester..."). Everything else
 *   is empty in that case; the caller should record no section rather than an
 *   empty one.
 */

const CAPACITY_LABEL = /Max\.\s*Classroom\s*Capacity\s*:?\s*<\/b>\s*([^<]*)/i;

/** The page's own title, used to reject a redirect or error page outright. */
const PAGE_TITLE = /<title>\s*Quota Information\s*<\/title>/i;

/**
 * The registration system's own "this section is not in dersbilgileri" body.
 * A well-formed answer to a question about a section that does not exist — not
 * a layout change, and not an error page either (the title is the normal one).
 */
const NO_SUCH_COURSE = /No\s+Such\s+Course\s+In\s+This\s+Semester/i;

/**
 * The per-section heading, e.g.
 *   …Surname Restriction(s), if any, for <br><br><font …><strong>AD  501.01</strong>
 * This — not the capacity label — is the format-change detector: AD501.01 in
 * 2026/2027-1 is a real page that emits the heading and then nothing at all (no
 * capacity, no tables), which is a graduate section with no assigned classroom
 * rather than a broken page. A page without the heading is a layout change.
 */
const SECTION_HEADING = /Surname\s+Restriction\(s\)[\s\S]{0,400}?<strong>\s*([^<]*?)\s*<\/strong>/i;

const TABLE_KINDS = [
  { kind: "departmental", pattern: /Departmental\s+Quota/i },
  { kind: "class", pattern: /Class\s+Quota/i },
  { kind: "surname", pattern: /Surname/i },
];

/**
 * Collapse the &nbsp; the site pads every cell with, then trim.
 * @param {string} raw
 */
function normalizeText(raw) {
  return raw.replace(/\u00a0/g, " ").trim();
}

/** @param {cheerio.CheerioAPI} $ @param {import("domhandler").AnyNode} element */
function cellText($, element) {
  return normalizeText($(element).text());
}

/**
 * Map a quota table's `tr.title` labels to column indices.
 * @param {string[]} labels
 * @returns {Record<string, number>}
 */
function indexLabels(labels) {
  /** @type {Record<string, number>} */
  const map = {};
  labels.forEach((label, index) => {
    const key = label.toLowerCase().replace(/[^a-z]/g, "");
    if (key && !(key in map)) map[key] = index;
  });
  return map;
}

/**
 * Parse "134" / "134 " / "" into a number, or null when the cell is not numeric.
 * @param {string | undefined} raw
 * @returns {number | null}
 */
function toNumber(raw) {
  if (!raw) return null;
  const match = raw.match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * Read one quota table into rows keyed by its own header labels.
 * @param {cheerio.CheerioAPI} $
 * @param {import("domhandler").AnyNode} table
 * @param {string} caption
 * @returns {{rows: QuotaRow[], warnings: string[]}}
 */
function parseQuotaTable($, table, caption) {
  /** @type {QuotaRow[]} */
  const rows = [];
  /** @type {string[]} */
  const warnings = [];

  const titleRow = $(table).find("tr.title").first();
  if (titleRow.length === 0) {
    warnings.push(`"${caption}" table has no header row (tr.title)`);
    return { rows, warnings };
  }
  const labels = titleRow
    .find("th,td")
    .toArray()
    .map((c) => cellText($, c));
  const columns = indexLabels(labels);
  // Quota and Current are the whole point of the page; without them the row
  // numbers would be meaningless, so a header that lacks them is a layout
  // change rather than a "no data" page.
  if (!("quota" in columns) || !("current" in columns)) {
    throw new Error(
      `"${caption}" table header missing Quota/Current (labels: ${labels.join(" | ")})`,
    );
  }
  // "Department" on the departmental table; a class table is expected to label
  // its first column "Class" instead. Fall back to column 0 either way.
  const deptColumn = columns.department ?? columns.class ?? 0;

  for (const tr of $(table).find("tr.schtd").toArray()) {
    const cells = $(tr)
      .find("td")
      .toArray()
      .map((c) => cellText($, c));
    const quotaCell = cells[columns.quota] ?? "";
    const quota = toNumber(quotaCell);
    const current = toNumber(cells[columns.current]);
    // A row with nothing numeric and nothing written in Quota is filler.
    if (quota === null && current === null && !quotaCell) continue;
    // Current is a plain enrolled count on every page we have captured; a
    // non-numeric one is an unverified shape, so report instead of guessing.
    if (current === null) {
      warnings.push(`"${caption}" row [${cells.join(" | ")}] has a non-numeric Current`);
      continue;
    }
    /** @type {QuotaRow} */
    const row = {
      dept: cells[deptColumn] ?? "",
      status: columns.statu === undefined ? "" : (cells[columns.statu] ?? ""),
      quota: quota ?? 0,
      current,
    };
    // "Consent Of Instructor" and friends: no numeric allocation, but the
    // wording is the actual registration rule, so keep it verbatim.
    if (quota === null) row.note = quotaCell;
    rows.push(row);
  }
  return { rows, warnings };
}

/**
 * Read one surname-restriction table. Shape unverified (see module comment):
 * anything other than a two-endpoint "from"/"to" pair is passed through as a
 * warning so a real example shows up in the scraper log.
 * @param {cheerio.CheerioAPI} $
 * @param {import("domhandler").AnyNode} table
 * @returns {{surname: SurnameRestriction[], warnings: string[]}}
 */
function parseSurnameTable($, table) {
  /** @type {SurnameRestriction[]} */
  const surname = [];
  /** @type {string[]} */
  const warnings = [];

  for (const tr of $(table).find("tr.schtd").toArray()) {
    const cells = $(tr)
      .find("td")
      .toArray()
      .map((c) => cellText($, c))
      .filter(Boolean);
    if (cells.length === 0) continue;
    // Either two endpoint cells ("A", "K") or one hyphenated cell ("A-K").
    const range = cells.length === 1 ? cells[0].split(/\s*[-–]\s*/) : cells.slice(-2);
    if (range.length === 2 && range[0] && range[1]) {
      surname.push({ from: range[0], to: range[1] });
    } else {
      warnings.push(`unrecognised surname restriction row [${cells.join(" | ")}]`);
    }
  }
  return { surname, warnings };
}

/**
 * Parse one quotasearch.asp page.
 * @param {string} html decoded page HTML
 * @param {string} [label] section key used in error messages, e.g. "MATH101.01"
 * @returns {QuotaPage}
 */
export function parseQuotaPage(html, label = "?") {
  if (!PAGE_TITLE.test(html)) {
    throw new Error(`${label}: not a Quota Information page (title missing)`);
  }
  // Checked before the heading, because this page deliberately omits it.
  if (NO_SUCH_COURSE.test(html)) {
    return { cap: null, rows: [], surname: [], warnings: [], absent: true };
  }
  const headingMatch = html.match(SECTION_HEADING);
  if (!headingMatch) {
    throw new Error(
      `${label}: section heading absent — quotasearch.asp layout changed`,
    );
  }

  /** @type {string[]} */
  const warnings = [];
  // The site renders codes with internal padding ("AD  501.01"); our keys do
  // not. A real mismatch means the server ignored the query and answered about
  // a different section, which would silently attribute one course's enrolment
  // to another — worth reporting, but as a warning so one odd cross-listed
  // alias cannot abort a 2900-page crawl.
  const heading = headingMatch[1].replace(/\s+/g, "");
  if (label !== "?" && heading !== label.replace(/\s+/g, "")) {
    warnings.push(`${label}: page is about ${heading}`);
  }

  // No capacity label at all is the legitimate "nothing recorded" page (see
  // SECTION_HEADING), so cap is simply null.
  const capacityMatch = html.match(CAPACITY_LABEL);
  const cap = capacityMatch ? toNumber(capacityMatch[1]) : null;

  const $ = cheerio.load(html);
  /** @type {QuotaRow[]} */
  const rows = [];
  /** @type {SurnameRestriction[]} */
  const surname = [];

  for (const table of $("table").toArray()) {
    const caption = normalizeText($(table).find("tr.rectitle").first().text());
    // The page always emits two empty trailer tables with no caption; those are
    // the "no data" case, not a problem.
    if (!caption) continue;
    const match = TABLE_KINDS.find(({ pattern }) => pattern.test(caption));
    if (!match) {
      warnings.push(`${label}: unrecognised quota table "${caption}"`);
      continue;
    }
    if (match.kind === "surname") {
      const parsed = parseSurnameTable($, table);
      surname.push(...parsed.surname);
      warnings.push(...parsed.warnings.map((w) => `${label}: ${w}`));
      continue;
    }
    const parsed = parseQuotaTable($, table, caption);
    rows.push(...parsed.rows);
    warnings.push(...parsed.warnings.map((w) => `${label}: ${w}`));
  }

  return { cap, rows, surname, warnings, absent: false };
}
