/**
 * Pure roadmap logic: cross-term prerequisite checking and credit totals.
 * Terms are ordered oldest-first in `orderedTerms`; a prerequisite counts as
 * satisfied if it is in `completed` OR taught in any EARLIER roadmap term.
 * Dangling prereq references are ignored (spec decision).
 */

/**
 * @param {Record<string, string[]>} roadmap
 * @param {string[]} orderedTerms oldest-first
 * @param {Set<string>} completed
 * @param {Record<string, { prereqs: string[] }>} prereqs
 */
export function checkRoadmapPrereqs(roadmap, orderedTerms, completed, prereqs) {
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
 * @param {string} semesterKey
 * @param {Record<string, string[]>} roadmap
 * @param {Record<string, any>} termData semester course map keyed by section name
 */
export function termCredits(semesterKey, roadmap, termData) {
  const codeToCredits = {};
  for (const [sectionName, info] of Object.entries(termData)) {
    const base = sectionName.split(".")[0];
    if (info && typeof info.credits !== "undefined" && !(base in codeToCredits)) {
      codeToCredits[base] = Number(info.credits) || 0;
    }
  }
  let total = 0;
  for (const code of roadmap[semesterKey] || []) {
    total += codeToCredits[code] || 0;
  }
  return total;
}

export function sortTermsNewestFirst(terms) {
  return [...terms].sort((a, b) => b.localeCompare(a));
}
