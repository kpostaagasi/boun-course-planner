import test from "node:test";
import assert from "node:assert/strict";

import { buildSearchPattern, compileSearch } from "../../../src/lib/searchQuery.mjs";

test("queries that used to crash the catalogue now compile", () => {
  // Each of these threw from inside the searchedCourseNames derived before the
  // tokens were escaped, which blanked the whole course list.
  for (const query of ["C++", "((", "*ab", "[z-a]", "a)", "a{2,", "?x", "^$"]) {
    assert.doesNotThrow(() => compileSearch(query), `query ${JSON.stringify(query)}`);
  }
});

test("a dot matches a literal dot, not any character", () => {
  // Scraped instructor names carry initials like "F.YILMAZ"; as a wildcard this
  // silently matched names the user never asked for.
  const regex = compileSearch("F.YILMAZ");
  assert.ok(regex);
  assert.equal(regex.test("FATİH F.YILMAZ"), true);
  assert.equal(regex.test("FXYILMAZ"), false);
});

test("a literal + is matched literally", () => {
  const regex = compileSearch("C++");
  assert.ok(regex);
  assert.equal(regex.test("INTRODUCTION TO C++"), true);
  assert.equal(regex.test("CCC"), false);
});

test("tokens stay OR-ed, preserving the existing search contract", () => {
  const regex = compileSearch("CMPE MATH");
  assert.ok(regex);
  assert.equal(regex.test("CMPE150.01"), true);
  assert.equal(regex.test("MATH101.01"), true);
  assert.equal(regex.test("PHYS101.01"), false);
});

test("tokens shorter than two characters are dropped", () => {
  // A single letter matches nearly every course, so it is not searchable.
  assert.equal(buildSearchPattern("a"), "");
  assert.equal(buildSearchPattern("a b"), "");
  assert.equal(buildSearchPattern("ab c"), "ab");
});

test("an empty or whitespace-only query yields no matcher", () => {
  assert.equal(buildSearchPattern(""), "");
  assert.equal(buildSearchPattern("   "), "");
  assert.equal(compileSearch(""), null);
  assert.equal(compileSearch("   "), null);
});

test("matching is case-insensitive", () => {
  const regex = compileSearch("cmpe");
  assert.ok(regex);
  assert.equal(regex.test("CMPE150.01"), true);
});

test("escaping is confined to metacharacters", () => {
  // Ordinary alphanumeric queries must pass through untouched, so the common
  // case does not pay for the hardening.
  assert.equal(buildSearchPattern("CMPE150"), "CMPE150");
  assert.equal(buildSearchPattern("linear algebra"), "linear|algebra");
});
