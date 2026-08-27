/**
 * Pure future-term logic: synthesise BOUN term keys past the last published
 * term, and predict from offering history whether a course is likely to run in
 * a term nobody has published yet.
 *
 * BOUN publishes one term at a time, so `semesters.json` only ever contains
 * terms that already happened or are running. A planning board that lists only
 * published terms therefore has nothing to plan with; these helpers generate
 * the terms that come next and qualify every claim made about them.
 *
 * Term keys come in two interchangeable forms:
 *   display form "YYYY/YYYY-T"  (semesters.json, roadmap keys)
 *   file form    "YYYY-YYYY-T"  (data/<key>.json, offerings.json)
 * T is the season: 1 = Fall, 2 = Spring, 3 = Summer — which is also their
 * chronological order inside one academic year.
 */

import { termHistory } from "./termHistory.mjs";

/** Terms in one academic year: Fall, Spring, Summer. */
export const SEASONS_PER_YEAR = 3;

/**
 * @typedef {Object} ParsedTerm
 * @property {number} startYear academic year start, e.g. 2026 for "2026/2027-1"
 * @property {number} season 1 = Fall, 2 = Spring, 3 = Summer
 * @property {"/"|"-"} sep separator between the two years in the source key
 * @property {number} ordinal absolute term index, increasing with real time
 */

/**
 * @param {string} term
 * @returns {ParsedTerm | null} null when `term` is not a BOUN term key
 */
export function parseTerm(term) {
  const m = /^(\d{4})([/-])(\d{4})-([1-3])$/.exec(String(term ?? ""));
  if (!m) return null;
  const startYear = Number(m[1]);
  // The second year must be the first plus one; anything else is not a term.
  if (Number(m[3]) !== startYear + 1) return null;
  const season = Number(m[4]);
  return {
    startYear,
    season,
    sep: m[2] === "/" ? "/" : "-",
    ordinal: startYear * SEASONS_PER_YEAR + (season - 1),
  };
}

/**
 * Absolute term ordinal, monotonically increasing with real-world time.
 * @param {string} term
 * @returns {number | null}
 */
export function termOrdinal(term) {
  const p = parseTerm(term);
  return p ? p.ordinal : null;
}

/**
 * @param {number} ordinal
 * @param {"/"|"-"} [sep]
 * @returns {string}
 */
export function formatTerm(ordinal, sep = "/") {
  const startYear = Math.floor(ordinal / SEASONS_PER_YEAR);
  const season = (ordinal % SEASONS_PER_YEAR) + 1;
  return `${startYear}${sep}${startYear + 1}-${season}`;
}

/**
 * Chronological comparator, ascending. Keys that are not BOUN term keys sort
 * before every real term and lexicographically among themselves, so the result
 * is a total order for any input.
 *
 * String comparison alone is NOT chronological: "-" (U+002D) sorts before "/"
 * (U+002F), so as soon as display-form and file-form keys meet in one list,
 * "2027-2028-1" claims to be newer than "2026/2027-3".
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
 * @param {string} term
 * @returns {string} file form ("YYYY-YYYY-T"); non-term keys pass through
 */
export function toFileKey(term) {
  const p = parseTerm(term);
  return p ? formatTerm(p.ordinal, "-") : term;
}

/**
 * @param {string} term
 * @returns {string} display form ("YYYY/YYYY-T"); non-term keys pass through
 */
export function toDisplayKey(term) {
  const p = parseTerm(term);
  return p ? formatTerm(p.ordinal, "/") : term;
}

/**
 * @param {string} term
 * @returns {string | null} the term right after `term`, same separator form
 */
export function nextTerm(term) {
  const p = parseTerm(term);
  return p ? formatTerm(p.ordinal + 1, p.sep) : null;
}

/**
 * The `count` terms following `newestPublished`, oldest-first, in the same
 * separator form as the input.
 * @param {string} newestPublished
 * @param {number} count
 * @returns {string[]}
 */
export function synthesiseFutureTerms(newestPublished, count) {
  const p = parseTerm(newestPublished);
  if (!p || !Number.isFinite(count) || count <= 0) return [];
  /** @type {string[]} */
  const out = [];
  const n = Math.floor(count);
  for (let i = 1; i <= n; i += 1) out.push(formatTerm(p.ordinal + i, p.sep));
  return out;
}

/**
 * @typedef {"known"|"high"|"medium"|"low"|"none"} OfferingConfidence
 */

/**
 * @typedef {Object} OfferingPrediction
 * @property {OfferingConfidence} confidence
 * @property {boolean} likely confidence is "known", "high" or "medium"
 * @property {boolean} known the target term is published AND lists the course
 * @property {number} count offerings across all seasons
 * @property {number} seasonCount offerings in the target term's season
 * @property {number[]} seasons seasons the course has ever run in
 * @property {"every"|"yearly"|"sparse"} pattern overall offering pattern
 * @property {"every"|"yearly"|"sparse"} seasonPattern pattern within the season
 * @property {number} coverage share of academic years in the observed window in
 *   which the course ran in that season, 0..1
 * @property {string | null} lastTerm newest term offered, file form
 * @property {string | null} lastSeasonTerm newest same-season term, file form
 * @property {number | null} yearsSinceLast academic years from `lastSeasonTerm`
 *   to the target term
 */

/** @type {Record<OfferingConfidence, number>} */
const CONFIDENCE_ORDER = { known: 4, high: 3, medium: 2, low: 1, none: 0 };

/**
 * @param {OfferingConfidence} confidence
 * @returns {number} higher means stronger evidence
 */
export function confidenceRank(confidence) {
  return CONFIDENCE_ORDER[confidence] ?? 0;
}

/**
 * How confident can we be that a course runs in `targetTerm`?
 *
 * When the term is published and lists the course this is ground truth
 * ("known"). Otherwise it is an inference and the caller must present it as
 * one. Two things decide it, because BOUN courses are season-bound: how much
 * of the observed window the course covered *in that season*, and how long ago
 * it last ran in that season. `termHistory`'s pattern is used as the regularity
 * signal; coverage keeps a single skipped year from demoting a course that has
 * otherwise run every year.
 *
 * @param {string[] | null | undefined} offeredTerms terms the course ran in
 * @param {string} targetTerm the term being planned
 * @param {{ horizonTerm?: string }} [opts] newest term with published data; it
 *   bounds the window coverage is measured over. Defaults to the newest term in
 *   `offeredTerms`.
 * @returns {OfferingPrediction}
 */
export function predictOffering(offeredTerms, targetTerm, opts = {}) {
  const target = parseTerm(targetTerm);
  /** @type {ParsedTerm[]} */
  const parsed = [];
  for (const raw of offeredTerms ?? []) {
    const p = parseTerm(raw);
    if (p) parsed.push(p);
  }
  parsed.sort((a, b) => a.ordinal - b.ordinal);
  const history = termHistory(parsed.map((p) => formatTerm(p.ordinal, "-")));
  const last = parsed.length > 0 ? parsed[parsed.length - 1] : null;

  const seasonal = target ? parsed.filter((p) => p.season === target.season) : [];
  const seasonHistory = termHistory(seasonal.map((p) => formatTerm(p.ordinal, "-")));
  const lastSeason = seasonal.length > 0 ? seasonal[seasonal.length - 1] : null;

  const horizon = parseTerm(opts.horizonTerm ?? "") ?? last;
  let coverage = 0;
  if (horizon && seasonal.length > 0) {
    const window = Math.max(1, horizon.startYear - seasonal[0].startYear + 1);
    coverage = Math.min(1, seasonHistory.count / window);
  }
  const yearsSinceLast =
    target && lastSeason ? target.startYear - lastSeason.startYear : null;
  const known =
    target !== null && parsed.some((p) => p.ordinal === target.ordinal);

  /** @type {OfferingConfidence} */
  let confidence;
  if (known) {
    confidence = "known";
  } else if (seasonHistory.count === 0 || yearsSinceLast === null) {
    // Never ran in this season: say so instead of guessing.
    confidence = "none";
  } else {
    const regular = seasonHistory.pattern === "yearly" || coverage >= 0.7;
    if (yearsSinceLast <= 1 && seasonHistory.count >= 3 && regular) {
      confidence = "high";
    } else if (
      (yearsSinceLast <= 1 && seasonHistory.count >= 2) ||
      (yearsSinceLast <= 2 && seasonHistory.count >= 3 && coverage >= 0.4)
    ) {
      confidence = "medium";
    } else {
      confidence = "low";
    }
  }

  return {
    confidence,
    likely:
      confidence === "known" || confidence === "high" || confidence === "medium",
    known,
    count: history.count,
    seasonCount: seasonHistory.count,
    seasons: history.seasons,
    pattern: history.pattern,
    seasonPattern: seasonHistory.pattern,
    coverage,
    lastTerm: last ? formatTerm(last.ordinal, "-") : null,
    lastSeasonTerm: lastSeason ? formatTerm(lastSeason.ordinal, "-") : null,
    yearsSinceLast,
  };
}

/**
 * @typedef {{ code: string, prediction: OfferingPrediction }} PredictedCourse
 */

/**
 * Codes from an offering archive that could run in `targetTerm`, strongest
 * evidence first. Courses with no history at all are dropped; courses with
 * history but none in the target season are kept last, labelled for what they
 * are, so a student can still plan them deliberately.
 *
 * @param {Record<string, string[]> | null | undefined} offerings
 * @param {string} targetTerm
 * @param {{ horizonTerm?: string, prefix?: string, limit?: number }} [opts]
 * @returns {PredictedCourse[]}
 */
export function predictedCourses(offerings, targetTerm, opts = {}) {
  const prefix = (opts.prefix ?? "").toUpperCase();
  /** @type {PredictedCourse[]} */
  const out = [];
  for (const [code, terms] of Object.entries(offerings ?? {})) {
    // Filter before predicting: prediction is ~25 term parses per course.
    if (prefix && !code.toUpperCase().startsWith(prefix)) continue;
    const prediction = predictOffering(terms, targetTerm, {
      horizonTerm: opts.horizonTerm,
    });
    if (prediction.count === 0) continue;
    out.push({ code, prediction });
  }
  out.sort((a, b) => {
    const byConfidence =
      confidenceRank(b.prediction.confidence) -
      confidenceRank(a.prediction.confidence);
    return byConfidence !== 0 ? byConfidence : a.code.localeCompare(b.code);
  });
  return typeof opts.limit === "number" ? out.slice(0, opts.limit) : out;
}
