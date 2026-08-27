/**
 * Instructor index: the catalogue's only person-shaped view of the data.
 *
 * `instructor` is the single field present on 100% of the sections of all 25
 * term files, and until now it was used only as a substring inside the search
 * chain. These helpers turn it into an entity: who teaches what this term,
 * which sections, and — across whatever slice of history the caller hands in —
 * which courses a person teaches repeatedly, plus the reverse direction, who
 * has taught a given course.
 *
 * Two hazards drive the whole design, both measured on the shipped files:
 *
 * 1. The cell is scraped free text. Across the 25 terms, 2032 distinct
 *    spellings collapse into 2011 people: the same person appears as
 *    "NECLA BİRGÜL-İYİSON" and "NECLA BİRGÜL İYİSON", "BAHAR İNCE(KASAPGİL)"
 *    and "BAHAR İNCE KASAPGİL", "FATİMAT ZHILETEZHEVA" and
 *    "FATIMAT ZHILETEZHEVA" (dotted vs dotless i), "NURAY AKÇA" and
 *    "NURAY AKCA". Grouping therefore runs on a normalised key, while the
 *    *display* string is always one of the real scraped spellings: that is
 *    what registration.boun.edu.tr prints and what a student can recognise.
 *    Prettifying it would produce a name that matches no official page.
 * 2. `STAFF STAFF` is not a person — 82 sections this term, 979 across the
 *    archive. Placeholder cells are excluded from the index and only counted,
 *    so no caller can render one as somebody with a teaching history. The
 *    predicate lives in ./courseKey.mjs and is shared with the course card.
 *
 * Initials are deliberately *not* collapsed: "FATİH F.YILMAZ" and a
 * hypothetical "FATİH YILMAZ" stay two keys, because a middle initial can just
 * as easily distinguish two people as spell one of them inconsistently, and
 * over-merging would attribute someone else's sections to a person. The one
 * measured near-collision in the current term ("AHMET TEKIN" vs
 * "AHMET TEZCAN TEKIN") is left as two entries for the same reason.
 */

import { baseCode, isPlaceholderInstructor } from "./courseKey.mjs";

/**
 * One raw section record as it appears in `public/data/<term>.json`. Only
 * `instructor` is guaranteed; 42.5% of the sections of the current term carry
 * an empty `days`, and `credits`/`dept`/`rooms` are missing on ~6.5%.
 * @typedef {Object} SectionRecord
 * @property {string} [instructor]
 * @property {string} [name]
 * @property {string} [code]
 * @property {string[]} [days]
 * @property {number[]} [hours]
 * @property {string[]} [rooms]
 */

/**
 * One term's course map plus its file key ("2026-2027-1").
 * @typedef {Object} TermDataset
 * @property {string} term
 * @property {Record<string, SectionRecord>} data
 */

/**
 * A section of the primary term, flattened for rendering.
 * @typedef {Object} InstructorSection
 * @property {string} sectionKey raw catalogue key ("CMPE150.01", "AD 211.01")
 * @property {string} code base course code ("CMPE150", "AD211")
 * @property {string} name course title, "" when the scrape had none
 * @property {string[]} days day codes, index-aligned with `hours`
 * @property {number[]} hours 1-based slots; clock hour is slot + 8
 * @property {string[]} rooms
 */

/**
 * One course a person teaches, aggregated over the indexed terms.
 * @typedef {Object} InstructorCourse
 * @property {string} code base course code
 * @property {string} name course title from the newest indexed term that had one
 * @property {string[]} terms indexed terms in which this person taught it
 * @property {string[]} sectionKeys primary-term section keys only
 */

/**
 * @typedef {Object} InstructorEntry
 * @property {string} key normalised grouping key
 * @property {string} display the scraped spelling to show
 * @property {string[]} variants every scraped spelling seen, `display` first
 * @property {InstructorSection[]} sections primary-term sections, catalogue order
 * @property {InstructorCourse[]} courses across all indexed terms, by code
 * @property {string[]} terms indexed terms in which this person taught anything
 */

/**
 * @typedef {Object} InstructorIndex
 * @property {string[]} terms indexed term keys, primary first, caller's order
 * @property {Record<string, InstructorEntry>} byKey
 * @property {string[]} keys every key, ascending
 * @property {Record<string, string[]>} courseToKeys base code → keys, most
 *   persistent teacher first
 * @property {number} placeholderSections placeholder cells skipped, all terms
 */

/**
 * @typedef {Object} InstructorCredit
 * @property {string} key
 * @property {string} display
 * @property {string[]} terms
 * @property {string[]} sectionKeys
 */

/**
 * Grouping key for a scraped instructor cell. Upper-case, ASCII-folded, single
 * spaces, punctuation dropped:
 *   "FATİH F.YILMAZ"        → "FATIH F YILMAZ"
 *   "BAHAR İNCE(KASAPGİL)"  → "BAHAR INCE KASAPGIL"
 *   "müge  taşkın-aydın"    → "MUGE TASKIN AYDIN"
 *
 * Turkish casing is the trap this function exists to avoid. `"İ".toLowerCase()`
 * is the two-code-point string `"i\u0307"`, which never round-trips back to
 * `"İ"`, and `"ı".toLocaleUpperCase("tr")` is `"I"` while
 * `"i".toLocaleUpperCase("tr")` is `"İ"` — so any lower-casing or locale-aware
 * casing step makes the key depend on the runtime's locale. Instead: NFD, drop
 * every combining mark (which is what erases the dot of İ and the diaeresis of
 * Ü alike), then `toUpperCase()`, which is defined to be locale-*insensitive*
 * and maps both "i" and "ı" to "I". Anything that is not a letter or a digit
 * becomes a separator, so hyphens, parentheses and the dots of initials all
 * behave like spaces.
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function normalizeInstructorName(raw) {
  const stripped = String(raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toUpperCase();
  let out = "";
  for (const ch of stripped) {
    out += /[\p{L}\p{N}]/u.test(ch) ? ch : " ";
  }
  return out.trim().replace(/\s+/g, " ");
}

/**
 * @param {Map<string, number>} counts
 * @returns {string}
 */
function pickDisplay(counts) {
  let best = "";
  let bestCount = -1;
  // Highest count wins; ties break lexicographically so the choice is stable
  // whatever order the terms were handed in.
  for (const [raw, count] of counts) {
    if (count > bestCount || (count === bestCount && raw < best)) {
      best = raw;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Build an instructor index over one or more terms.
 *
 * `terms[0]` is the *primary* term: the only one that contributes `sections`
 * and `sectionKeys`, because those carry days/hours/rooms that are meaningful
 * only for the term the user is looking at. Every indexed term contributes to
 * `courses[].terms`, `entry.terms` and `courseToKeys`, which is what "has
 * taught this before" is derived from.
 *
 * Callers decide the historical window. Handing in a single term is legitimate
 * and cheap; the caller then has to say so, because a one-term index cannot
 * tell "teaches this every year" from "teaches this for the first time".
 * @param {TermDataset[]} terms newest first by convention
 * @returns {InstructorIndex}
 */
export function buildInstructorIndex(terms) {
  const datasets = (Array.isArray(terms) ? terms : []).filter(
    (entry) => entry && typeof entry.term === "string" && entry.data,
  );

  /**
   * @typedef {Object} Acc
   * @property {Map<string, number>} primaryCounts
   * @property {Map<string, number>} allCounts
   * @property {InstructorSection[]} sections
   * @property {Map<string, { code: string, name: string, terms: Set<string>, sectionKeys: string[] }>} courses
   * @property {Set<string>} terms
   */
  /** @type {Map<string, Acc>} */
  const acc = new Map();
  /** @type {Map<string, Set<string>>} */
  const courseToKeys = new Map();
  const termKeys = datasets.map((entry) => entry.term);
  let placeholderSections = 0;

  for (let i = 0; i < datasets.length; i += 1) {
    const { term, data } = datasets[i];
    const isPrimary = i === 0;

    for (const [sectionKey, info] of Object.entries(data)) {
      const raw = String(info?.instructor ?? "");
      if (isPlaceholderInstructor(raw)) {
        placeholderSections += 1;
        continue;
      }
      const key = normalizeInstructorName(raw);
      if (key === "") {
        placeholderSections += 1;
        continue;
      }

      let entry = acc.get(key);
      if (!entry) {
        entry = {
          primaryCounts: new Map(),
          allCounts: new Map(),
          sections: [],
          courses: new Map(),
          terms: new Set(),
        };
        acc.set(key, entry);
      }
      entry.allCounts.set(raw, (entry.allCounts.get(raw) ?? 0) + 1);
      if (isPrimary) {
        entry.primaryCounts.set(raw, (entry.primaryCounts.get(raw) ?? 0) + 1);
      }
      entry.terms.add(term);

      const code = baseCode(sectionKey);
      let course = entry.courses.get(code);
      if (!course) {
        course = { code, name: "", terms: new Set(), sectionKeys: [] };
        entry.courses.set(code, course);
      }
      course.terms.add(term);
      // Terms arrive newest first, so the first title seen is the freshest one.
      if (course.name === "" && info?.name) course.name = String(info.name);
      if (isPrimary) course.sectionKeys.push(sectionKey);

      let teachers = courseToKeys.get(code);
      if (!teachers) {
        teachers = new Set();
        courseToKeys.set(code, teachers);
      }
      teachers.add(key);

      if (isPrimary) {
        entry.sections.push({
          sectionKey,
          code,
          name: info?.name ? String(info.name) : "",
          days: Array.isArray(info?.days) ? info.days.map(String) : [],
          hours: Array.isArray(info?.hours) ? info.hours.map(Number) : [],
          rooms: Array.isArray(info?.rooms) ? info.rooms.map(String) : [],
        });
      }
    }
  }

  /** @type {Record<string, InstructorEntry>} */
  const byKey = {};
  for (const [key, entry] of acc) {
    const display = pickDisplay(
      entry.primaryCounts.size > 0 ? entry.primaryCounts : entry.allCounts,
    );
    const variants = [
      display,
      ...[...entry.allCounts.keys()].filter((raw) => raw !== display).sort(),
    ];
    const courses = [...entry.courses.values()]
      .map((course) => ({
        code: course.code,
        name: course.name,
        terms: termKeys.filter((term) => course.terms.has(term)),
        sectionKeys: course.sectionKeys,
      }))
      .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    byKey[key] = {
      key,
      display,
      variants,
      sections: entry.sections,
      courses,
      terms: termKeys.filter((term) => entry.terms.has(term)),
    };
  }

  /** @type {Record<string, string[]>} */
  const courseIndex = {};
  for (const [code, keys] of courseToKeys) {
    courseIndex[code] = [...keys].sort((a, b) => {
      const aTerms = byKey[a].courses.find((c) => c.code === code)?.terms.length ?? 0;
      const bTerms = byKey[b].courses.find((c) => c.code === code)?.terms.length ?? 0;
      if (aTerms !== bTerms) return bTerms - aTerms;
      return a < b ? -1 : a > b ? 1 : 0;
    });
  }

  return {
    terms: termKeys,
    byKey,
    keys: Object.keys(byKey).sort(),
    courseToKeys: courseIndex,
    placeholderSections,
  };
}

/**
 * The person a query names exactly, or null.
 *
 * This is what lets a raw name land precisely. The catalogue search chain ORs
 * the space-separated tokens of a query and only consults `instructor` when the
 * course-code branch came back empty, so searching "İLHAN OR" actually returns
 * every POR/OR course and none of his sections. An exact key hit sidesteps the
 * chain entirely, and because the comparison runs on the normalised key, any
 * scraped spelling of the same person resolves to the same entry.
 * @param {InstructorIndex} index
 * @param {string | null | undefined} query
 * @returns {InstructorEntry | null}
 */
export function matchInstructorQuery(index, query) {
  const key = normalizeInstructorName(query);
  if (key === "") return null;
  return index.byKey[key] ?? null;
}

/**
 * Instructors whose key contains every token of the query, best first: exact
 * key, then key prefix, then a token prefix, then anything else; within a rank,
 * whoever teaches more sections in the primary term.
 * @param {InstructorIndex} index
 * @param {string | null | undefined} query
 * @param {number} [limit]
 * @returns {InstructorEntry[]}
 */
export function findInstructors(index, query, limit = 6) {
  const q = normalizeInstructorName(query);
  if (q.length < 2) return [];
  const tokens = q.split(" ");

  /** @param {string} key */
  const rank = (key) => {
    if (key === q) return 0;
    if (key.startsWith(q)) return 1;
    const parts = key.split(" ");
    return tokens.every((token) => parts.some((part) => part.startsWith(token)))
      ? 2
      : 3;
  };

  return index.keys
    .filter((key) => tokens.every((token) => key.includes(token)))
    .map((key) => ({ key, rank: rank(key) }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const bySections =
        index.byKey[b.key].sections.length - index.byKey[a.key].sections.length;
      if (bySections !== 0) return bySections;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    })
    .slice(0, Math.max(0, limit))
    .map((hit) => index.byKey[hit.key]);
}

/**
 * Who has taught a course, over the indexed terms, most persistent first.
 * Accepts either a base code or a full section key.
 * @param {InstructorIndex} index
 * @param {string | null | undefined} code
 * @returns {InstructorCredit[]}
 */
export function instructorsForCourse(index, code) {
  const base = baseCode(String(code ?? ""));
  const keys = index.courseToKeys[base] ?? [];
  return keys.map((key) => {
    const entry = index.byKey[key];
    const course = entry.courses.find((c) => c.code === base);
    return {
      key: entry.key,
      display: entry.display,
      terms: course ? course.terms : [],
      sectionKeys: course ? course.sectionKeys : [],
    };
  });
}
