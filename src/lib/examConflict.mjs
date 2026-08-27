/**
 * Final-exam clash detection across a set of sections.
 *
 * The registrar's schedule table carries two exam columns that the parser now
 * copies verbatim onto each section (see `setIfPresent` in `tools/lib/parse.mjs`):
 *
 *   `examDate`  the "Exam" cell. Observed format, measured over the archived
 *               schedule fixtures: `DD.MM.YYYY` — `10.01.2022`, `19.01.2022`,
 *               `30.12.2025`. Day-first, because the source is a Turkish site.
 *   `examSlot`  the "Sl." cell. Observed values: `"1"`, `"2"`, `"3"` — the exam
 *               session within that day. Two sections clash only when they
 *               share BOTH the date and the session.
 *
 * Both cells are blank for a whole term until the exam schedule is published,
 * and both are free text, so the parse is defensive and has a third answer.
 * The rule that matters: **an unparseable value is "unknown", never "no
 * clash"**. Quietly reporting "no exam conflict" because a date failed to parse
 * would be worse than saying nothing, because the user would act on it.
 *
 * Hence four statuses, not two:
 *   clash    same date, same session — definite, provable from the data
 *   maybe    same date, at least one session unreadable — cannot be ruled out
 *   clear    every comparison was fully readable and none collided
 *   unknown  something needed for the comparison is missing or unreadable
 */

/**
 * One section's exam coordinates.
 * @typedef {object} ExamSection
 * @property {string} key section key, e.g. `"CMPE150.01"`
 * @property {string} [examDate] verbatim "Exam" cell
 * @property {string} [examSlot] verbatim "Sl." cell
 */

/**
 * @typedef {object} ExamClash
 * @property {string} a
 * @property {string} b
 * @property {string} date canonical `YYYY-MM-DD`
 * @property {number} slot shared exam session
 */

/**
 * @typedef {object} ExamMaybe
 * @property {string} a
 * @property {string} b
 * @property {string} date canonical `YYYY-MM-DD` the two share
 */

/**
 * @typedef {object} ExamReport
 * @property {ExamClash[]} conflicts provable same-date-same-session pairs
 * @property {ExamMaybe[]} unresolved same-date pairs whose session is unreadable
 *   on at least one side; a clash here can be neither confirmed nor ruled out
 * @property {string[]} unknown keys whose exam date is absent or unparseable, so
 *   they took part in no comparison at all
 */

/**
 * @typedef {object} ExamStatus
 * @property {"clash" | "maybe" | "clear" | "unknown"} status
 * @property {string[]} with the other section keys involved
 * @property {number} compared how many other sections were in the comparison set
 */

/** `DD.MM.YYYY` (observed) and its `DD/MM/YYYY` spelling. */
const DAY_FIRST = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/;
/** `YYYY-MM-DD`, in case the value ever arrives already normalized. */
const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/**
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {string | null}
 */
function canonical(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject 31.02: round-tripping through Date catches every impossible day
  // without a per-month table.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse an "Exam" cell into `YYYY-MM-DD`, or null when it is absent or not a
 * date we recognise. Null is the honest answer, not a fallback.
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function parseExamDate(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;

  const dayFirst = DAY_FIRST.exec(text);
  if (dayFirst) {
    return canonical(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
  }
  const iso = ISO.exec(text);
  if (iso) {
    return canonical(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  return null;
}

/**
 * Parse a "Sl." cell into an exam session number, or null when it is absent or
 * not a plain small integer.
 * @param {string | number | null | undefined} raw
 * @returns {number | null}
 */
export function parseExamSlot(raw) {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,2}$/.test(text)) return null;
  const slot = Number(text);
  return slot >= 1 && slot <= 24 ? slot : null;
}

/**
 * @param {ExamSection[]} sections
 * @returns {{key: string, date: string | null, slot: number | null}[]}
 */
function normalize(sections) {
  return sections.map((section) => ({
    key: section.key,
    date: parseExamDate(section.examDate),
    slot: parseExamSlot(section.examSlot),
  }));
}

/**
 * Pairwise final-exam report over a set of sections.
 * @param {ExamSection[]} sections
 * @returns {ExamReport}
 */
export function examConflicts(sections) {
  const parsed = normalize(sections);

  /** @type {ExamClash[]} */
  const conflicts = [];
  /** @type {ExamMaybe[]} */
  const unresolved = [];
  const unknown = parsed.filter((p) => p.date === null).map((p) => p.key);

  for (let i = 0; i < parsed.length; i++) {
    const a = parsed[i];
    if (a.date === null) continue;
    for (let j = i + 1; j < parsed.length; j++) {
      const b = parsed[j];
      // An unreadable date on either side means the pair is simply not
      // comparable — recorded once through `unknown`, never as "no clash".
      if (b.date === null || a.date !== b.date) continue;
      if (a.slot === null || b.slot === null) {
        unresolved.push({ a: a.key, b: b.key, date: a.date });
      } else if (a.slot === b.slot) {
        conflicts.push({ a: a.key, b: b.key, date: a.date, slot: a.slot });
      }
      // Same day, both sessions readable and different: genuinely no clash.
    }
  }

  return { conflicts, unresolved, unknown };
}

/**
 * The report from one section's point of view — what a course card needs.
 *
 * `clear` is deliberately hard to earn: it requires this section's date to be
 * readable AND every other section's date to be readable, so that every pair
 * was actually decided. Anything less is `unknown`, which a caller must render
 * as silence rather than as reassurance.
 * @param {string} key the section the card is about
 * @param {ExamSection[]} sections the comparison set, `key` included or not
 * @returns {ExamStatus}
 */
export function examConflictFor(key, sections) {
  const parsed = normalize(sections);
  const self = parsed.find((p) => p.key === key);
  const peers = parsed.filter((p) => p.key !== key);

  if (!self || self.date === null) {
    return { status: "unknown", with: [], compared: peers.length };
  }

  /** @type {string[]} */
  const clash = [];
  /** @type {string[]} */
  const maybe = [];
  let allPeersReadable = true;

  for (const peer of peers) {
    if (peer.date === null) {
      allPeersReadable = false;
      continue;
    }
    if (peer.date !== self.date) continue;
    if (self.slot === null || peer.slot === null) {
      maybe.push(peer.key);
    } else if (self.slot === peer.slot) {
      clash.push(peer.key);
    }
  }

  if (clash.length > 0) {
    return { status: "clash", with: clash, compared: peers.length };
  }
  if (maybe.length > 0) {
    return { status: "maybe", with: maybe, compared: peers.length };
  }
  return {
    status: allPeersReadable ? "clear" : "unknown",
    with: [],
    compared: peers.length,
  };
}
