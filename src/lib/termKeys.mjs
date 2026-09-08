/**
 * Pure BOUN term-key ordering.
 *
 * Term keys come in two interchangeable forms:
 *   display form "YYYY/YYYY-T"  (semesters.json)
 *   file form    "YYYY-YYYY-T"  (data/<key>.json, offerings.json)
 * T is the season: 1 = Fall, 2 = Spring, 3 = Summer — which is also their
 * chronological order inside one academic year.
 *
 * Sorting these as plain strings is NOT chronological, which is the whole
 * reason this module exists: "-" (U+002D) sorts before "/" (U+002F), so as
 * soon as the two forms meet in one list, "2027-2028-1" claims to be newer
 * than "2026/2027-3". Both forms reach the instructor panel's history window,
 * because it merges `semesters.json` with keys it derives from data filenames.
 */

/** Terms in one academic year: Fall, Spring, Summer. */
const SEASONS_PER_YEAR = 3;

/**
 * @typedef {Object} ParsedTerm
 * @property {number} startYear academic year start, e.g. 2026 for "2026/2027-1"
 * @property {number} season 1 = Fall, 2 = Spring, 3 = Summer
 * @property {number} ordinal absolute term index, increasing with real time
 */

/**
 * @param {string} term
 * @returns {ParsedTerm | null} null when `term` is not a BOUN term key
 */
function parseTerm(term) {
  const m = /^(\d{4})([/-])(\d{4})-([1-3])$/.exec(String(term ?? ""));
  if (!m) return null;
  const startYear = Number(m[1]);
  // The second year must be the first plus one; anything else is not a term.
  if (Number(m[3]) !== startYear + 1) return null;
  const season = Number(m[4]);
  return {
    startYear,
    season,
    ordinal: startYear * SEASONS_PER_YEAR + (season - 1),
  };
}

/**
 * Chronological comparator, ascending. Keys that are not BOUN term keys sort
 * before every real term and lexicographically among themselves, so the result
 * is a total order for any input.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareTerms(a, b) {
  const pa = parseTerm(a);
  const pb = parseTerm(b);
  if (pa && pb) return pa.ordinal - pb.ordinal;
  if (pa) return 1;
  if (pb) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Newest-first chronological order.
 * @param {string[]} terms
 * @returns {string[]}
 */
export function sortTermsNewestFirst(terms) {
  return [...terms].sort((a, b) => compareTerms(b, a));
}
