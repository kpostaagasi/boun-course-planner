/**
 * Pure roadmap logic: cross-term prerequisite checking, course metadata lookup
 * and per-term credit totals.
 * Terms are ordered oldest-first in `orderedTerms`; a prerequisite counts as
 * satisfied if it is in `completed` OR taught in any EARLIER roadmap term.
 * Dangling prereq references are ignored (spec decision).
 */

import { compareTerms } from "./futureTerms.mjs";

/** More ECTS than this in one term is an overload (BOUN norm is ~30). */
export const ECTS_OVERLOAD_THRESHOLD = 40;

/**
 * @param {Record<string, string[]>} roadmap
 * @param {string[]} orderedTerms oldest-first
 * @param {Set<string>} completed
 * @param {Record<string, { prereqs: string[] }>} prereqs
 */
export function checkRoadmapPrereqs(roadmap, orderedTerms, completed, prereqs) {
  /** @type {Record<string, Record<string, { ok: boolean, missing: string[] }>>} */
  const result = {};
  const seen = new Set(completed);
  // Courses known to exist: prereqs-map entries plus everything scheduled in
  // the roadmap. A prereq outside this set is dangling and ignored (spec
  // decision); one scheduled in the same or a later term is genuinely unmet.
  const known = new Set(Object.keys(prereqs));
  for (const codes of Object.values(roadmap)) {
    for (const code of codes) known.add(code);
  }
  for (const term of orderedTerms) {
    result[term] = {};
    for (const code of roadmap[term] || []) {
      const entry = prereqs[code];
      if (!entry) {
        result[term][code] = { ok: true, missing: [] };
        continue;
      }
      const missing = (entry.prereqs || []).filter(
        (p) => !seen.has(p) && known.has(p),
      );
      result[term][code] = { ok: missing.length === 0, missing };
    }
    for (const code of roadmap[term] || []) seen.add(code);
  }
  return result;
}

/**
 * @typedef {Object} CatalogEntry
 * @property {string} name
 * @property {number | undefined} credits undefined = no dataset stated it
 * @property {number | undefined} ects
 */

/**
 * Collapse per-term section maps ("CMPE150.01" -> record) into a base-code
 * catalogue. Datasets are consulted in order and the first one that states a
 * field wins, so pass them NEWEST TERM FIRST: for a term with no data of its
 * own, that is exactly "the numbers from the most recent known offering".
 *
 * @param {(Record<string, any> | null | undefined)[]} datasets
 * @returns {Record<string, CatalogEntry>}
 */
export function courseCatalog(datasets) {
  /** @type {Record<string, CatalogEntry>} */
  const out = {};
  for (const data of datasets) {
    if (!data) continue;
    for (const [sectionName, info] of Object.entries(data)) {
      if (!info) continue;
      const base = sectionName.split(".")[0];
      let entry = out[base];
      if (!entry) {
        entry = { name: "", credits: undefined, ects: undefined };
        out[base] = entry;
      }
      if (!entry.name && typeof info.name !== "undefined") {
        entry.name = String(info.name);
      }
      if (typeof entry.credits === "undefined" && typeof info.credits !== "undefined") {
        entry.credits = Number(info.credits) || 0;
      }
      if (typeof entry.ects === "undefined" && typeof info.ects !== "undefined") {
        entry.ects = Number(info.ects) || 0;
      }
    }
  }
  return out;
}

/**
 * Credit and ECTS totals for one roadmap term, plus the overload verdict.
 * @param {string} semesterKey
 * @param {Record<string, string[]>} roadmap
 * @param {Record<string, CatalogEntry>} catalog
 * @returns {{ credits: number, ects: number, overload: boolean }}
 */
export function termLoad(semesterKey, roadmap, catalog) {
  let credits = 0;
  let ects = 0;
  for (const code of roadmap[semesterKey] || []) {
    const entry = catalog[code];
    if (!entry) continue;
    credits += entry.credits || 0;
    ects += entry.ects || 0;
  }
  return { credits, ects, overload: ects > ECTS_OVERLOAD_THRESHOLD };
}

/**
 * @param {string} semesterKey
 * @param {Record<string, string[]>} roadmap
 * @param {Record<string, any>} termData semester course map keyed by section name
 */
export function termCredits(semesterKey, roadmap, termData) {
  return termLoad(semesterKey, roadmap, courseCatalog([termData])).credits;
}

/**
 * @param {string} semesterKey
 * @param {Record<string, string[]>} roadmap
 * @param {Record<string, any>} termData semester course map keyed by section name
 */
export function termEcts(semesterKey, roadmap, termData) {
  return termLoad(semesterKey, roadmap, courseCatalog([termData])).ects;
}

/**
 * Newest-first chronological order. Delegates to `compareTerms`, which parses
 * the key: string comparison is wrong once display-form ("2026/2027-1") and
 * file-form ("2027-2028-1") keys meet in one list, because "-" < "/".
 * @param {string[]} terms
 * @returns {string[]}
 */
export function sortTermsNewestFirst(terms) {
  return [...terms].sort((a, b) => compareTerms(b, a));
}
