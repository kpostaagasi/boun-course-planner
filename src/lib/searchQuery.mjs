/**
 * Turning a user's search box input into a regex.
 *
 * Extracted from globalState.svelte.ts so `node --test` can pin the escaping:
 * the tokens are raw user input spliced into a `RegExp`, and before escaping,
 * ordinary queries crashed the catalogue. `new RegExp("C++")` throws "Nothing
 * to repeat" and `new RegExp("((")` throws "Unterminated group" — both from
 * inside a `$derived`, which takes the whole course list down rather than
 * returning no results. Unescaped dots were also silently wrong: a search for
 * the scraped instructor name "F.YILMAZ" compiled to a wildcard.
 */

/** Regex metacharacters that must be neutralised before splicing. */
const METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

/** Shortest token worth searching; single letters match nearly everything. */
const MIN_TOKEN_LENGTH = 2;

/**
 * Build the alternation source for a query, or "" when nothing is searchable.
 *
 * Tokens are OR-ed, which is the app's existing search contract: any token may
 * match. Narrowing that to AND would change every existing search result, so it
 * is deliberately left alone here.
 *
 * @param {string} query raw search box contents
 * @returns {string} regex source, safe to pass to `new RegExp`
 */
export function buildSearchPattern(query) {
  return query
    .trim()
    .split(" ")
    .filter((token) => token.length >= MIN_TOKEN_LENGTH)
    .map((token) => token.replace(METACHARACTERS, "\\$&"))
    .join("|");
}

/**
 * Compile a query to a case-insensitive matcher, or null when the query holds
 * nothing searchable.
 *
 * @param {string} query
 * @returns {RegExp | null}
 */
export function compileSearch(query) {
  const pattern = buildSearchPattern(query);
  return pattern ? new RegExp(pattern, "i") : null;
}
