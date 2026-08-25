// Pure command-palette search over one semester's course data.
// Kept dependency-free so node:test can cover it directly (project pattern:
// pure logic in .mjs, Svelte wrappers re-export with types).

/**
 * @typedef {Object} CourseInfo
 * @property {string} [code]
 * @property {string} [name]
 * @property {string} [instructor]
 */

/**
 * @typedef {Object} PaletteEntry
 * @property {string} courseName   Key into semester data, e.g. "CMPE210.01"
 * @property {string} code         Base code, e.g. "CMPE210"
 * @property {string} title        Course title
 * @property {string} instructor
 */

/**
 * Flatten a semester record to palette entries.
 * @param {Record<string, CourseInfo>} semesterData
 * @returns {PaletteEntry[]}
 */
export function buildPaletteEntries(semesterData) {
  if (!semesterData) return [];
  const entries = [];
  for (const [courseName, info] of Object.entries(semesterData)) {
    if (!info || typeof info !== "object") continue;
    const code = courseName.split(".")[0].replace(/\s+/g, "");
    entries.push({
      courseName,
      code,
      title: typeof info.name === "string" ? info.name : "",
      instructor: typeof info.instructor === "string" ? info.instructor : "",
    });
  }
  return entries;
}

/**
 * Rank palette entries for a query.
 * Scoring: exact base-code match > code prefix > code substring >
 * title/instructor substring. Ties broken by original order (stable sort).
 *
 * @param {PaletteEntry[]} entries
 * @param {string} query
 * @param {number} [limit=20]
 * @returns {PaletteEntry[]}
 */
export function searchPalette(entries, query, limit = 20) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  /** @type {Array<{entry: PaletteEntry, score: number}>} */
  const scored = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    let score = -1;
    if (e.code.toLowerCase() === q) {
      score = 0;
    } else if (e.code.toLowerCase().startsWith(q)) {
      score = 1;
    } else if (e.code.toLowerCase().includes(q)) {
      score = 2;
    } else if (
      e.title.toLowerCase().includes(q) ||
      e.instructor.toLowerCase().includes(q)
    ) {
      score = 3;
    }
    if (score >= 0) scored.push({ entry: e, score: score * 1000 + i });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.entry);
}
