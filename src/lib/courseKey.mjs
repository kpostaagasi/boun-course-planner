/**
 * Canonical identity helpers for the scraped catalogue strings.
 *
 * Section keys are the raw `Code.Sec` cell with internal whitespace kept, so
 * the same course appears as `CMPE150.01`, `AD 211.01` and `AD251.01 P.S. 1`
 * depending on department and sub-row. Everything keyed by *course* rather than
 * by *section* — prereqs.json, descriptions.json, offerings.json, the completed
 * set — uses the space-free base code, so the conversion has to happen at every
 * boundary. It used to be inlined as `key.split(".")[0].replace(/\s+/g, "")`
 * four separate times inside one component; this module is the single copy.
 */

/**
 * Section key → base course code.
 *
 * `"CMPE150.01"` → `"CMPE150"`, `"AD 211.01"` → `"AD211"`,
 * `"AD251.01 P.S. 1"` → `"AD251"`, `"AD48L.01"` → `"AD48L"`.
 *
 * Splitting on the first `.` is what makes the P.S./LAB sub-row keys work: the
 * suffix lives after the section number, so it is discarded with it.
 * @param {string} sectionKey
 * @returns {string}
 */
export function baseCode(sectionKey) {
  return sectionKey.split(".")[0].replace(/\s+/g, "");
}

/**
 * Instructor cells that name nobody. The registrar publishes unstaffed
 * sections as `STAFF STAFF` (82 sections of 2026/2027-1, 979 across all 25
 * terms), and the Turkish pages have historically used "belirtilmedi"
 * placeholders, so both vocabularies are covered.
 *
 * Matching is per token and requires *every* token to be a placeholder, which
 * is the whole reason this is not a substring test: `CEREN ABI MC GREEVY
 * STAFFORD` contains "STAFF" and `EKREM KUTBAY` contains "TBA".
 */
const PLACEHOLDER_TOKENS = new Set([
  "STAFF",
  "TBA",
  "TBD",
  "NA",
  "N/A",
  "-",
  "--",
  "?",
  "BELIRTILMEDI",
  "BELIRTILMEMIS",
  "BELIRLENMEDI",
]);

/**
 * Uppercase a token without depending on the runtime's Turkish casing rules:
 * `"İ".toUpperCase()` is stable but `"ı".toUpperCase()` is `"I"` only under a
 * non-Turkish locale, so the diacritics are folded first.
 * @param {string} token
 * @returns {string}
 */
function fold(token) {
  return token
    .replace(/[İıI]/g, "I")
    .replace(/[Şş]/g, "S")
    .replace(/[Ğğ]/g, "G")
    .replace(/[Üü]/g, "U")
    .replace(/[Öö]/g, "O")
    .replace(/[Çç]/g, "C")
    .toUpperCase()
    .replace(/[.,]/g, "");
}

/**
 * Is this instructor cell a placeholder rather than a person?
 *
 * Callers use it to suppress affordances that only make sense for a real name
 * — searching the catalogue for `STAFF STAFF` returns 82 unrelated sections,
 * which is worse than offering nothing. An empty cell counts as a placeholder.
 * @param {string | null | undefined} instructor
 * @returns {boolean}
 */
export function isPlaceholderInstructor(instructor) {
  const tokens = String(instructor ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => PLACEHOLDER_TOKENS.has(fold(token)));
}
