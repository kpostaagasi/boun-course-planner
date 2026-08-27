/**
 * Pure derivation of the course card's quota / live-enrolment display model.
 *
 * `public/data/quota.json` is produced by `tools/scrape-quota.mjs`, which
 * *compacts* every record: `cap` is omitted when the page states no classroom
 * capacity, and `rows` / `surname` are omitted when empty — which, over a whole
 * term, is the majority case. On top of that the registrar's "Quota" cell is
 * not always a number: `AD251.05` of 2026/2027-1 serves the literal text
 * `Consent Of Instructor` there, and the scraper keeps that verbatim in the
 * row's `note` while storing `quota: 0`.
 *
 * So there are five genuinely different states, and collapsing any of them into
 * a number would be a lie:
 *
 *   unknown        no record at all, or a record with nothing usable in it
 *   capacity-only  we know the room holds N people and nothing else
 *   enrolment      at least one row carries a real numeric allocation
 *   note-only      rows exist but none allocates seats; the note IS the rule
 *   (over-enrolled is `enrolment` with `current > quota`, which happens: the
 *    registrar routinely admits past the allocation)
 *
 * The hard rule this module exists to enforce: a missing section, missing
 * `rows` or missing `cap` yields `null`, never `0`. `0` on a course card reads
 * as "no seats left", and "we have no data" is not that.
 */

/**
 * One stored departmental- or class-quota row. Mirrors `QuotaRow` in
 * `tools/lib/parse-quota.mjs`, but every field is optional here because this
 * module's whole job is to survive a file that does not match expectations.
 * @typedef {object} QuotaRowInput
 * @property {string} [dept]
 * @property {string} [status]
 * @property {number} [quota]
 * @property {number} [current]
 * @property {string} [note]
 */

/**
 * One stored section. `note` is not emitted at section level by the current
 * producer (notes live on rows), but it is accepted here so a future
 * section-level note surfaces instead of being dropped.
 * @typedef {object} QuotaSectionInput
 * @property {number | null} [cap]
 * @property {QuotaRowInput[]} [rows]
 * @property {unknown[]} [surname]
 * @property {string} [note]
 */

/**
 * @typedef {object} QuotaDisplay
 * @property {"unknown" | "capacity-only" | "enrolment" | "note-only"} kind
 * @property {number | null} cap max classroom capacity, null when unrecorded
 * @property {number | null} quota summed allocation, null when none is numeric
 * @property {number | null} current summed live enrolment, null when unrecorded
 * @property {number | null} free seats left, never negative, null when unknown
 * @property {boolean} full allocation reached or exceeded
 * @property {boolean} overEnrolled enrolment strictly above the allocation
 * @property {string[]} depts departments named by the rows, "ALL" excluded
 * @property {boolean} restricted the rows name specific departments
 * @property {string[]} statuses class standings named by the rows, "ALL" excluded
 * @property {string[]} notes verbatim non-numeric quota cells, in file order
 * @property {number} surnameCount surname restrictions recorded
 * @property {boolean} surnameRestricted `surnameCount > 0`
 */

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function textOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** A row's `dept`/`status` of "ALL" means "no restriction", not a department. */
const UNRESTRICTED = /^all$/i;

/**
 * Build the card's quota display model from one stored section.
 * @param {QuotaSectionInput | null | undefined} section
 * @returns {QuotaDisplay}
 */
export function quotaDisplay(section) {
  const cap = numberOrNull(section?.cap);
  const rows = Array.isArray(section?.rows) ? section.rows : [];

  /** @type {string[]} */
  const notes = [];
  const sectionNote = textOrEmpty(section?.note);
  if (sectionNote) notes.push(sectionNote);

  /** @type {number | null} */
  let quota = null;
  /** @type {number | null} */
  let current = null;
  /** @type {string[]} */
  const depts = [];
  /** @type {string[]} */
  const statuses = [];

  for (const row of rows) {
    const note = textOrEmpty(row?.note);
    if (note) notes.push(note);

    const rowCurrent = numberOrNull(row?.current);
    if (rowCurrent !== null) current = (current ?? 0) + rowCurrent;

    // A row carrying a `note` had a non-numeric Quota cell. The producer stores
    // `quota: 0` there so sums stay arithmetically valid, but zero is not an
    // allocation — counting it would turn "consent of instructor" into "0 of 0
    // seats", i.e. a fabricated FULL. Only noteless rows contribute.
    if (!note) {
      const rowQuota = numberOrNull(row?.quota);
      if (rowQuota !== null) quota = (quota ?? 0) + rowQuota;
    }

    const dept = textOrEmpty(row?.dept);
    if (dept && !UNRESTRICTED.test(dept) && !depts.includes(dept)) {
      depts.push(dept);
    }
    const status = textOrEmpty(row?.status);
    if (status && !UNRESTRICTED.test(status) && !statuses.includes(status)) {
      statuses.push(status);
    }
  }

  const surnameCount = Array.isArray(section?.surname) ? section.surname.length : 0;

  /** @type {QuotaDisplay["kind"]} */
  let kind;
  if (quota !== null) kind = "enrolment";
  else if (notes.length > 0) kind = "note-only";
  else if (cap !== null) kind = "capacity-only";
  else kind = "unknown";

  /** @type {number | null} */
  let free = null;
  let full = false;
  let overEnrolled = false;
  // Both halves must be real numbers before any seat arithmetic is allowed.
  if (quota !== null && current !== null) {
    free = Math.max(0, quota - current);
    full = current >= quota;
    overEnrolled = current > quota;
  }

  return {
    kind,
    cap,
    quota,
    current,
    free,
    full,
    overEnrolled,
    depts,
    restricted: depts.length > 0,
    statuses,
    notes,
    surnameCount,
    surnameRestricted: surnameCount > 0,
  };
}

/**
 * @typedef {object} QuotaAge
 * @property {"minute" | "hour" | "day"} unit coarsest unit that is still ≥ 1
 * @property {number} value whole units elapsed
 * @property {number} minutes exact whole minutes elapsed, for threshold checks
 */

/**
 * How old is a scrape timestamp?
 *
 * Live enrolment moves within minutes during registration week, so a bare
 * `47 / 50` on a card is a claim the data cannot support. The card renders this
 * next to the numbers; returning a unit + value instead of a formatted string
 * keeps the wording translatable.
 *
 * A missing or unparseable `scrapedAt` returns null — the caller must then
 * treat the numbers as undatable rather than pretend they are current. A
 * timestamp in the future (clock skew) is clamped to zero rather than reported
 * as a negative age.
 * @param {string | null | undefined} scrapedAt ISO timestamp
 * @param {number} [now] epoch millis, defaults to `Date.now()`
 * @returns {QuotaAge | null}
 */
export function quotaAge(scrapedAt, now = Date.now()) {
  if (typeof scrapedAt !== "string") return null;
  const parsed = Date.parse(scrapedAt);
  if (Number.isNaN(parsed)) return null;

  const minutes = Math.max(0, Math.floor((now - parsed) / 60_000));
  if (minutes < 60) return { unit: "minute", value: minutes, minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hour", value: hours, minutes };
  return { unit: "day", value: Math.floor(hours / 24), minutes };
}
