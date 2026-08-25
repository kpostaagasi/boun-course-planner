/**
 * Pure eligibility logic: given a course code, the set of completed course
 * codes, and the prereqs.json map, decide whether the course is taken,
 * eligible, or missing prerequisites. Dangling prereq references (codes not
 * present in the prereqs map) are ignored — see spec decision.
 */

/**
 * @param {string} baseCode
 * @param {Set<string>} completed
 * @param {Record<string, { prereqs: string[] }> | null} prereqs
 * @returns {{ status: "taken"|"eligible"|"missing-prereq"|"no-data", missing: string[], moreMissing: boolean }}
 */
export function getEligibility(baseCode, completed, prereqs) {
  if (completed.has(baseCode)) {
    return { status: "taken", missing: [], moreMissing: false };
  }
  const entry = prereqs?.[baseCode];
  if (!entry) {
    return { status: "no-data", missing: [], moreMissing: false };
  }
  const missing = (entry.prereqs || []).filter(
    (p) => !completed.has(p) && (prereqs ? p in prereqs : false),
  );
  if (missing.length === 0) {
    return { status: "eligible", missing: [], moreMissing: false };
  }
  const moreMissing = missing.length > 3;
  return {
    status: "missing-prereq",
    missing: missing.slice(0, 3),
    moreMissing,
  };
}
