/**
 * Pure term-history logic: from a per-term offering archive, derive how often
 * a course is offered and in which seasons. Used by the Course card badge.
 *
 * Term keys use the site-wide file form "YYYY-YYYY-T" (e.g. "2025-2026-1").
 * Seasons: 1 = Fall, 2 = Spring, 3 = Summer.
 */

/**
 * @param {string[]} terms term keys in "YYYY-YYYY-T" form where the course was offered
 * @returns {{ count: number, seasons: number[], pattern: "every"|"yearly"|"sparse" }}
 */
export function termHistory(terms) {
  if (!terms || terms.length === 0) {
    return { count: 0, seasons: [], pattern: "sparse" };
  }
  const years = new Set();
  const seasons = new Set();
  let count = 0;
  for (const t of terms) {
    const m = /^(\d{4})-(\d{4})-(\d)$/.exec(t);
    if (!m) continue;
    count += 1;
    years.add(m[1]); // start year uniquely identifies an academic year
    seasons.add(Number(m[3]));
  }
  const academicYears = [...years].map(Number).sort((a, b) => a - b);
  const span = academicYears.length > 0
    ? academicYears[academicYears.length - 1] - academicYears[0] + 1
    : 0;
  // "every": more offerings than academic years (multiple terms per year);
  // "yearly": one term per academic year with no gap years;
  // "sparse": gaps between offering years or a single occurrence.
  const pattern =
    count > academicYears.length
      ? "every"
      : academicYears.length === span
        ? "yearly"
        : "sparse";
  return { count, seasons: [...seasons].sort(), pattern };
}
