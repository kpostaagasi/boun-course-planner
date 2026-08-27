// Pure command-palette search over one semester's course data.
// Kept dependency-free so node:test can cover it directly (project pattern:
// pure logic in .mjs, Svelte wrappers re-export with types).
//
// A palette row must let the user *choose*. Five rows reading
// "MATH101 CALCULUS I - MÜGE TAŞKIN AYDIN" are worse than useless when Enter
// adds a section immediately, so an entry carries everything that
// distinguishes one section from its siblings: the section key, the meeting
// days/hours, the rooms, the credits, and (when the quota dataset exists) the
// free-seat count.

/** Day codes as they appear in the scraped data, in weekday order. */
export const DAY_CODES = ["M", "T", "W", "Th", "F", "St"];

/**
 * Canonical short English day name per code. Also the default render label:
 * callers that can localize (the Svelte component, via `t("day.Mon")`) pass
 * their own `dayLabels` map into `describeSchedule`.
 * @type {Record<string, string>}
 */
export const DAY_NAMES = {
  M: "Mon",
  T: "Tue",
  W: "Wed",
  Th: "Thu",
  F: "Fri",
  St: "Sat",
};

/**
 * Rendered instead of a time for a section with no timetabled meeting. About
 * 42% of a live semester (theses, internships, untimetabled seminars) carries
 * no `days`, and those rows must say so rather than leave a blank gap.
 */
export const UNSCHEDULED_LABEL = "TBA";

/**
 * @typedef {Object} SectionInfo
 * @property {string} [code]
 * @property {string} [name]
 * @property {string} [instructor]
 * @property {number|string} [credits]
 * @property {string[]} [days]
 * @property {Array<number|string>} [hours]
 * @property {string[]} [rooms]
 */

/**
 * @typedef {Object} QuotaRow
 * @property {string} [dept]
 * @property {string} [status]
 * @property {number|string|null} [quota]
 * @property {number|string|null} [current]
 */

/**
 * @typedef {Object} QuotaRecord
 * @property {number|string|null} [cap]
 * @property {QuotaRow[]} [rows]
 * @property {unknown[]} [surname]
 */

/**
 * Seat availability for one section. `status: "unknown"` covers every
 * degraded case — quota.json absent, section missing from it, or a compacted
 * record with no rows — so rendering never has to distinguish "no data" from
 * "zero seats".
 * @typedef {Object} PaletteQuota
 * @property {"open"|"full"|"unknown"} status
 * @property {number|null} left      seats left; negative when over-enrolled
 * @property {number|null} cap       section capacity when known
 * @property {number|null} enrolled  students currently enrolled when known
 */

/**
 * @typedef {Object} PaletteEntry
 * @property {string} courseName   Section key, e.g. "CMPE210.01", "CMPE150.04 LAB 1"
 * @property {string} code         Base code, e.g. "CMPE210"
 * @property {string} section      Everything after the first dot, e.g. "01", "04 LAB 1"
 * @property {string} title        Course title
 * @property {string} instructor
 * @property {string[]} days       Day codes, index-aligned with `hours`/`rooms`
 * @property {number[]} hours      1-based timetable slots (slot 1 = 09:00)
 * @property {string[]} rooms      Room per meeting; "" when the scrape lacks one
 * @property {boolean} scheduled   false when the section has no usable meeting
 * @property {number|null} credits
 * @property {PaletteQuota} quota
 * @property {string} _code        lowercase mirrors, precomputed once per
 * @property {string} _title       semester so that searching 3000+ sections on
 * @property {string} _instructor  every keystroke allocates nothing
 * @property {string} _key
 */

/** @type {PaletteQuota} */
const UNKNOWN_QUOTA = Object.freeze({
  status: "unknown",
  left: null,
  cap: null,
  enrolled: null,
});

/**
 * Clock time of a 1-based timetable slot: slot 1 is 09:00, slot 14 is 22:00.
 * @param {number} slot
 * @returns {string}
 */
export function slotToClock(slot) {
  const hour = Number(slot) + 8;
  if (!Number.isFinite(hour)) return "";
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Non-negative count from scraped data, which may hand us numbers, numeric
 * strings, null, or nothing at all. Anything else is "unknown".
 * @param {unknown} value
 * @returns {number|null}
 */
function toCount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

/**
 * Collapse one section's quota rows into a seat count.
 *
 * `rows` holds one entry per departmental allocation, so enrolment is the sum
 * across rows, not row 0. Capacity is the section-level `cap` when present and
 * the summed per-row quotas otherwise; a missing `cap`, missing `rows`, or a
 * missing section all mean "unknown", never zero. `current > quota` happens
 * (over-enrolment by consent), which is why `left` is allowed to go negative.
 *
 * @param {QuotaRecord|null|undefined} record
 * @returns {PaletteQuota}
 */
export function summarizeQuota(record) {
  if (!record || typeof record !== "object") return UNKNOWN_QUOTA;
  const cap = toCount(record.cap);
  const rows = Array.isArray(record.rows) ? record.rows : [];
  let quotaSum = 0;
  let enrolled = 0;
  let sawRow = false;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const current = toCount(row.current);
    const quota = toCount(row.quota);
    if (current === null && quota === null) continue;
    sawRow = true;
    if (current !== null) enrolled += current;
    if (quota !== null) quotaSum += quota;
  }
  if (!sawRow) {
    return cap === null
      ? UNKNOWN_QUOTA
      : { status: "unknown", left: null, cap, enrolled: null };
  }
  const limit = cap !== null && cap > 0 ? cap : quotaSum > 0 ? quotaSum : null;
  if (limit === null) {
    return { status: "unknown", left: null, cap, enrolled };
  }
  const left = limit - enrolled;
  return { status: left > 0 ? "open" : "full", left, cap, enrolled };
}

/**
 * Flatten a semester record to palette entries.
 *
 * `quotaSections` is the `sections` map of quota.json and is optional on
 * purpose: that file is scraped separately and may be missing entirely, in
 * which case every entry gets `status: "unknown"` and the palette simply shows
 * no seat badges.
 *
 * @param {Record<string, SectionInfo> | null | undefined} semesterData
 * @param {Record<string, QuotaRecord> | null} [quotaSections]
 * @returns {PaletteEntry[]}
 */
export function buildPaletteEntries(semesterData, quotaSections) {
  if (!semesterData) return [];
  /** @type {PaletteEntry[]} */
  const entries = [];
  for (const [courseName, info] of Object.entries(semesterData)) {
    if (!info || typeof info !== "object") continue;
    const dot = courseName.indexOf(".");
    const code = (dot === -1 ? courseName : courseName.slice(0, dot)).replace(
      /\s+/g,
      "",
    );
    const section = dot === -1 ? "" : courseName.slice(dot + 1);
    const title = typeof info.name === "string" ? info.name : "";
    const instructor =
      typeof info.instructor === "string" ? info.instructor : "";

    // days/hours/rooms are parallel arrays in the source. Rebuild them
    // pairwise so the alignment is an invariant of the entry rather than an
    // assumption about the scrape: a meeting survives only if it has both a
    // day code and a usable slot number.
    const rawDays = Array.isArray(info.days) ? info.days : [];
    const rawHours = Array.isArray(info.hours) ? info.hours : [];
    const rawRooms = Array.isArray(info.rooms) ? info.rooms : [];
    /** @type {string[]} */
    const days = [];
    /** @type {number[]} */
    const hours = [];
    /** @type {string[]} */
    const rooms = [];
    const meetings = Math.min(rawDays.length, rawHours.length);
    for (let i = 0; i < meetings; i++) {
      const day = rawDays[i];
      const slot = Number(rawHours[i]);
      if (typeof day !== "string" || day === "" || !Number.isFinite(slot)) {
        continue;
      }
      days.push(day);
      hours.push(slot);
      rooms.push(typeof rawRooms[i] === "string" ? rawRooms[i] : "");
    }

    entries.push({
      courseName,
      code,
      section,
      title,
      instructor,
      days,
      hours,
      rooms,
      scheduled: days.length > 0,
      credits: toCount(info.credits),
      quota: quotaSections
        ? summarizeQuota(quotaSections[courseName])
        : UNKNOWN_QUOTA,
      _code: code.toLowerCase(),
      _title: title.toLowerCase(),
      _instructor: instructor.toLowerCase(),
      _key: courseName.toLowerCase(),
    });
  }
  return entries;
}

/**
 * Unique room names for a section, in meeting order.
 * @param {{ rooms: string[] }} entry
 * @returns {string[]}
 */
export function uniqueRooms(entry) {
  /** @type {string[]} */
  const out = [];
  for (const room of entry.rooms) {
    if (room !== "" && !out.includes(room)) out.push(room);
  }
  return out;
}

/**
 * @param {string} day
 * @returns {number}
 */
function dayOrder(day) {
  const idx = DAY_CODES.indexOf(day);
  return idx === -1 ? DAY_CODES.length : idx;
}

/**
 * Collapse consecutive slots into clock ranges: [1,2] -> "09:00-11:00",
 * [1,2,5] -> "09:00-11:00, 13:00".
 * @param {number[]} slots ascending, de-duplicated
 * @returns {string}
 */
function formatSlotRuns(slots) {
  /** @type {string[]} */
  const runs = [];
  let start = slots[0];
  let prev = slots[0];
  for (let i = 1; i <= slots.length; i++) {
    const slot = slots[i];
    if (i < slots.length && slot === prev + 1) {
      prev = slot;
      continue;
    }
    runs.push(
      prev === start
        ? slotToClock(start)
        : `${slotToClock(start)}-${slotToClock(prev + 1)}`,
    );
    start = slot;
    prev = slot;
  }
  return runs.join(", ");
}

/**
 * Human-readable meeting pattern, e.g. "Tue 09:00-11:00 · Thu 09:00-11:00".
 * Sections with no meeting return the (localizable) unscheduled label rather
 * than an empty string, so a row never renders as a blank gap.
 *
 * @param {{ days: string[], hours: number[] }} entry
 * @param {{ dayLabels?: Record<string, string>, unscheduled?: string }} [options]
 * @returns {string}
 */
export function describeSchedule(entry, options) {
  const unscheduled = options?.unscheduled ?? UNSCHEDULED_LABEL;
  if (entry.days.length === 0) return unscheduled;
  const labels = options?.dayLabels;
  /** @type {string[]} */
  const order = [];
  /** @type {Record<string, number[]>} */
  const slotsByDay = {};
  for (let i = 0; i < entry.days.length; i++) {
    const day = entry.days[i];
    const slot = entry.hours[i];
    if (!Number.isFinite(slot)) continue;
    let slots = slotsByDay[day];
    if (!slots) {
      slots = [];
      slotsByDay[day] = slots;
      order.push(day);
    }
    if (!slots.includes(slot)) slots.push(slot);
  }
  if (order.length === 0) return unscheduled;
  // Weekday order, not data order: a section listed Thu-then-Tue still reads
  // "Tue … Thu".
  order.sort((a, b) => dayOrder(a) - dayOrder(b));
  /** @type {string[]} */
  const parts = [];
  for (const day of order) {
    const slots = slotsByDay[day].slice().sort((a, b) => a - b);
    const label = labels?.[day] ?? DAY_NAMES[day] ?? day;
    parts.push(`${label} ${formatSlotRuns(slots)}`);
  }
  return parts.join(" · ");
}

// Match tiers, lowest = best. A multi-token query sums its tokens' tiers, so
// with one token this is exactly the historic ranking.
const TIER_CODE_EXACT = 0;
const TIER_CODE_PREFIX = 1;
const TIER_CODE_SUB = 2;
const TIER_TEXT = 3;
const TIER_KEY = 4;
const TIER_FUZZY = 5;
const NO_MATCH = -1;

/** Shortest token that may fuzzy-match, to keep single letters from matching everything. */
const MIN_FUZZY_TOKEN = 3;

/**
 * How many characters a fuzzy match may skip. Fuzzy matching here means
 * "typed the whole code but dropped a letter" ("mth101" -> MATH101), not
 * general subsequence search: without this bound "cmpe1" would also
 * subsequence-match CMPE210, and a prefix query would drag in half the
 * department.
 */
const MAX_FUZZY_SKIP = 1;

/**
 * @param {string} needle
 * @param {string} hay
 * @returns {boolean}
 */
function isSubsequence(needle, hay) {
  let n = 0;
  for (let h = 0; h < hay.length && n < needle.length; h++) {
    if (hay[h] === needle[n]) n++;
  }
  return n === needle.length;
}

/**
 * @param {PaletteEntry} entry
 * @param {string} token
 * @returns {number} tier, or NO_MATCH
 */
function tokenTier(entry, token) {
  if (entry._code === token) return TIER_CODE_EXACT;
  if (entry._code.startsWith(token)) return TIER_CODE_PREFIX;
  if (entry._code.includes(token)) return TIER_CODE_SUB;
  if (entry._title.includes(token) || entry._instructor.includes(token)) {
    return TIER_TEXT;
  }
  // The section key carries what the code does not: "01", "LAB", "P.S.".
  if (entry._key.includes(token)) return TIER_KEY;
  // Last resort, code only: "mth101" -> MATH101. Cheap (codes are ~7 chars).
  if (
    token.length >= MIN_FUZZY_TOKEN &&
    entry._code.length - token.length <= MAX_FUZZY_SKIP &&
    isSubsequence(token, entry._code)
  ) {
    return TIER_FUZZY;
  }
  return NO_MATCH;
}

/**
 * @param {string} query
 * @returns {string[]}
 */
function tokenize(query) {
  const q = typeof query === "string" ? query.trim().toLowerCase() : "";
  if (q === "") return [];
  return q.split(/\s+/);
}

/**
 * Rank palette entries for a query.
 *
 * Matching is multi-token AND: every whitespace-separated token must hit the
 * code, title, instructor, or section key, so "calc 1" and "cmpe150 lab" both
 * work. The tokens are additionally tried joined ("math 101" -> "math101") so
 * that a spaced-out code still ranks as an exact code hit.
 *
 * Results are grouped: matches are collected per base course code, courses are
 * ranked by their best section, and **whole** courses are emitted in section
 * order. This is the deliberate answer to the "five identical MATH101 rows"
 * problem. A flat per-section list spends the result budget on sections of
 * whichever course happened to match first, so the .04 of the course you
 * actually want can be cut off entirely; capping by course instead guarantees
 * that if a course is shown at all, every one of its matching sections is
 * shown, next to each other, distinguishable by the meeting time the entry now
 * carries. Expandable/collapsible groups were rejected: they add a mode and an
 * extra keystroke to a surface whose whole value is type-arrow-enter, and once
 * the time and section key are rendered there is nothing left to expand.
 *
 * `limit` is therefore a *course* count, not a row count; `maxSections` is a
 * DOM-size backstop that only ever drops whole courses.
 *
 * Ordering is total and deterministic (score, then first-appearance index), so
 * an identical query always yields an identical list and the keyboard
 * selection never jumps.
 *
 * @param {PaletteEntry[]} entries
 * @param {string} query
 * @param {number} [limit=8] max distinct courses
 * @param {number} [maxSections=40] max rows
 * @returns {PaletteEntry[]} matching sections, contiguous per course
 */
export function searchPalette(entries, query, limit = 8, maxSections = 40) {
  const tokens = tokenize(query);
  if (!entries || tokens.length === 0) return [];
  const joined = tokens.length > 1 ? tokens.join("") : "";
  /** @type {Map<string, {score: number, order: number, sections: PaletteEntry[]}>} */
  const groups = new Map();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let score = NO_MATCH;
    if (joined !== "") {
      if (entry._code === joined) score = TIER_CODE_EXACT;
      else if (entry._code.startsWith(joined)) score = TIER_CODE_PREFIX;
    }
    let sum = 0;
    for (const token of tokens) {
      const tier = tokenTier(entry, token);
      if (tier === NO_MATCH) {
        sum = NO_MATCH;
        break;
      }
      sum += tier;
    }
    if (sum !== NO_MATCH && (score === NO_MATCH || sum < score)) score = sum;
    if (score === NO_MATCH) continue;
    const group = groups.get(entry.code);
    if (!group) {
      groups.set(entry.code, { score, order: i, sections: [entry] });
    } else {
      group.sections.push(entry);
      if (score < group.score) group.score = score;
    }
  }
  const ranked = [...groups.values()].sort(
    (a, b) => a.score - b.score || a.order - b.order,
  );
  /** @type {PaletteEntry[]} */
  const out = [];
  let courses = 0;
  for (const group of ranked) {
    if (courses >= limit) break;
    // Never truncate a course mid-way; dropping ".05" silently is the bug.
    if (out.length > 0 && out.length + group.sections.length > maxSections) {
      break;
    }
    for (const entry of group.sections) out.push(entry);
    courses++;
  }
  return out;
}

/**
 * @typedef {Object} PaletteGroup
 * @property {string} code
 * @property {string} title    title of the group's first section
 * @property {PaletteEntry[]} sections
 */

/**
 * View transform over `searchPalette` output: fold the contiguous per-course
 * runs into groups for rendering headers. Order is preserved exactly, so the
 * flat list stays the keyboard-navigation index.
 * @param {PaletteEntry[]} results
 * @returns {PaletteGroup[]}
 */
export function groupPaletteResults(results) {
  /** @type {PaletteGroup[]} */
  const groups = [];
  /** @type {PaletteGroup|null} */
  let current = null;
  for (const entry of results) {
    if (!current || current.code !== entry.code) {
      current = { code: entry.code, title: entry.title, sections: [] };
      groups.push(current);
    }
    current.sections.push(entry);
  }
  return groups;
}
