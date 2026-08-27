// Pure mapping between the address bar and the planner's course selection.
// Kept dependency-free so node:test can cover it directly (project pattern:
// pure logic in .mjs, Svelte wrappers re-export with types).
//
// Wire format (unchanged from the original share links so old links keep
// working): `?d=<semester-key>&c=<sectionKey,sectionKey,...>`.

/**
 * @typedef {Object} UrlSelection
 * @property {string | null} semester  Term key such as "2026-2027-1", or null
 * @property {string[]} courses        Section keys such as "CMPE150.01"
 */

/** Query-string key holding the semester. */
const SEMESTER_PARAM = "d";
/** Query-string key holding the comma-separated section keys. */
const COURSES_PARAM = "c";

/** Published term keys look like "2026-2027-1" (fall/spring/summer). */
const TERM_KEY = /^\d{4}-\d{4}-[1-3]$/;

/**
 * True when `value` has the shape of a published term key.
 *
 * The list of *actually* published terms lives in data/semesters.json, which
 * this module deliberately does not know about; a shape check is enough to
 * reject junk like `?d=<script>` while staying pure.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTermKey(value) {
  return typeof value === "string" && TERM_KEY.test(value);
}

/**
 * Drop blanks, surrounding whitespace and duplicates from a section-key list.
 * A duplicate coming in from a hand-edited URL would otherwise render twice and
 * double-count credits.
 *
 * @param {readonly unknown[] | null | undefined} courses
 * @returns {string[]}
 */
export function normalizeCourses(courses) {
  if (!courses) return [];
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const course of courses) {
    if (typeof course !== "string") continue;
    const trimmed = course.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Read `?d=`/`?c=` out of a query string.
 *
 * @param {string | null | undefined} search  e.g. "?d=2026-2027-1&c=CMPE150.01"
 * @returns {UrlSelection}
 */
export function parseSelectionParams(search) {
  const params = new URLSearchParams(search ?? "");
  const semester = params.get(SEMESTER_PARAM);
  const coursesParam = params.get(COURSES_PARAM);
  return {
    semester: semester ? semester : null,
    courses: normalizeCourses(coursesParam ? coursesParam.split(",") : []),
  };
}

/**
 * Remove `?d=`/`?c=` while leaving any unrelated query parameter intact.
 *
 * @param {string | null | undefined} search
 * @returns {string} "" or "?<remaining params>"
 */
export function stripSelectionSearch(search) {
  const params = new URLSearchParams(search ?? "");
  params.delete(SEMESTER_PARAM);
  params.delete(COURSES_PARAM);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Render the current selection back into a query string, preserving unrelated
 * parameters. `c` is omitted when nothing is selected, and the whole query
 * string collapses to "" when there is nothing worth showing — an empty planner
 * deserves a clean URL.
 *
 * @param {string | null | undefined} search  existing query string to merge into
 * @param {string | null | undefined} semester
 * @param {readonly string[] | null | undefined} courses
 * @returns {string} "" or "?<params>"
 */
export function buildSelectionSearch(search, semester, courses) {
  const params = new URLSearchParams(stripSelectionSearch(search));
  const list = normalizeCourses(courses);
  if (semester) params.set(SEMESTER_PARAM, semester);
  if (list.length > 0) params.set(COURSES_PARAM, list.join(","));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Order-insensitive comparison used to skip no-op history writes.
 *
 * @param {readonly string[] | null | undefined} a
 * @param {readonly string[] | null | undefined} b
 * @returns {boolean}
 */
export function sameCourses(a, b) {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  for (let i = 0; i < sortedLeft.length; i++) {
    if (sortedLeft[i] !== sortedRight[i]) return false;
  }
  return true;
}

/**
 * Decide what the app should show on the first render.
 *
 * PRECEDENCE RULE (also asserted in tools/lib/test/urlState.test.mjs):
 *   A share link BEATS localStorage, but only for the semester it names and
 *   only on the visit that carries it. Sharing is otherwise broken: the
 *   recipient almost always has their own `semesterSelCourses2` entry already.
 *   Selections stored for *other* semesters are never touched, so following a
 *   link for one term does not destroy your plan for another.
 *   The caller strips `?d=`/`?c=` right after applying, so the user's own later
 *   edits (persisted to localStorage and mirrored back into the URL) can never
 *   be overwritten by a stale link on the next reload.
 *
 * A `?c=` list with no `?d=`, or with a `?d=` that is not a term key, lands on
 * `defaultSemester` — the term the app would have opened anyway.
 *
 * @param {Record<string, string[]>} stored           localStorage contents
 * @param {UrlSelection | null | undefined} urlSelection
 * @param {string} defaultSemester                    term the app would open by itself
 * @returns {{ semester: string, selection: Record<string, string[]>, changed: boolean }}
 */
export function resolveInitialSelection(stored, urlSelection, defaultSemester) {
  const semester = isTermKey(urlSelection?.semester)
    ? /** @type {string} */ (urlSelection?.semester)
    : defaultSemester;
  const courses = normalizeCourses(urlSelection?.courses);
  if (courses.length === 0 || !semester) {
    return { semester, selection: stored, changed: false };
  }
  return {
    semester,
    selection: { ...stored, [semester]: courses },
    changed: !sameCourses(stored[semester], courses),
  };
}

/**
 * Recover a selection from a popstate event.
 *
 * History entries created by this app carry the snapshot in `history.state`,
 * which survives even when the URL itself was stripped clean (the entry a share
 * link lands on). Entries without our snapshot — a hand-typed URL, or a reload
 * — fall back to the query string.
 *
 * @param {unknown} state    history.state
 * @param {string | null | undefined} search
 * @returns {UrlSelection}
 */
export function decodeHistoryState(state, search) {
  if (state && typeof state === "object" && "sel" in state) {
    const sel = /** @type {{ sel: unknown }} */ (state).sel;
    if (sel && typeof sel === "object") {
      const snapshot = /** @type {{ semester?: unknown, courses?: unknown }} */ (sel);
      return {
        semester:
          typeof snapshot.semester === "string" && snapshot.semester
            ? snapshot.semester
            : null,
        courses: normalizeCourses(
          Array.isArray(snapshot.courses) ? snapshot.courses : []
        ),
      };
    }
  }
  return parseSelectionParams(search);
}

/**
 * Build the `history.state` payload for a selection snapshot.
 *
 * @param {string} semester
 * @param {readonly string[]} courses
 * @returns {{ sel: { semester: string, courses: string[] } }}
 */
export function encodeHistoryState(semester, courses) {
  return { sel: { semester, courses: normalizeCourses(courses) } };
}
