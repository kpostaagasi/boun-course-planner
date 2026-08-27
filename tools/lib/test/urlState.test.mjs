import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSelectionSearch,
  decodeHistoryState,
  encodeHistoryState,
  isTermKey,
  normalizeCourses,
  parseSelectionParams,
  resolveInitialSelection,
  sameCourses,
  stripSelectionSearch,
} from "../../../src/lib/urlState.mjs";

test("encode/decode round-trips a selection", () => {
  const courses = ["CMPE150.01", "MATH101.02", "AD251.01 P.S. 1"];
  const search = buildSelectionSearch("", "2026-2027-1", courses);
  const parsed = parseSelectionParams(search);
  assert.equal(parsed.semester, "2026-2027-1");
  assert.deepEqual(parsed.courses, courses);
});

test("an empty selection produces no query string at all", () => {
  assert.equal(buildSelectionSearch("", "", []), "");
  assert.equal(buildSelectionSearch("?d=2026-2027-1&c=CMPE150.01", "", []), "");
  // A semester with nothing selected still deserves a `?d=` so the link lands
  // on the right term, but no empty `c=`.
  assert.equal(buildSelectionSearch("", "2026-2027-1", []), "?d=2026-2027-1");
  assert.deepEqual(parseSelectionParams("").courses, []);
  assert.equal(parseSelectionParams("").semester, null);
});

test("malformed ?c= values are filtered, not trusted", () => {
  // Zero-length entries (the original hardening), whitespace and duplicates.
  const parsed = parseSelectionParams("?c=,,CMPE150.01,,%20MATH101.02%20,CMPE150.01,");
  assert.deepEqual(parsed.courses, ["CMPE150.01", "MATH101.02"]);
  assert.deepEqual(parseSelectionParams("?c=").courses, []);
  assert.deepEqual(parseSelectionParams("?c=,,,").courses, []);
  assert.deepEqual(normalizeCourses(["a", null, 3, "  ", "a"]), ["a"]);
});

test("an unknown semester key falls back to the default term", () => {
  assert.equal(isTermKey("2026-2027-1"), true);
  assert.equal(isTermKey("2026-2027-4"), false);
  assert.equal(isTermKey("../../etc/passwd"), false);
  assert.equal(isTermKey(null), false);

  const resolved = resolveInitialSelection(
    {},
    { semester: "not-a-term", courses: ["CMPE150.01"] },
    "2026-2027-1"
  );
  assert.equal(resolved.semester, "2026-2027-1");
  assert.deepEqual(resolved.selection, { "2026-2027-1": ["CMPE150.01"] });
});

test("a ?c= link with no ?d= applies to whichever term is current", () => {
  // Regression: this used to be resolved against a `currentSemester` that was
  // still "" at module load, so the whole selection was silently dropped.
  const resolved = resolveInitialSelection(
    {},
    { semester: null, courses: ["CMPE150.01", "MATH101.02"] },
    "2026-2027-1"
  );
  assert.equal(resolved.semester, "2026-2027-1");
  assert.deepEqual(resolved.selection["2026-2027-1"], [
    "CMPE150.01",
    "MATH101.02",
  ]);
  assert.equal(resolved.changed, true);

  // ...and it must not land under the empty-string key when no term is known.
  const deferred = resolveInitialSelection({}, { semester: null, courses: ["CMPE150.01"] }, "");
  assert.equal(deferred.changed, false);
  assert.deepEqual(deferred.selection, {});
});

test("a share link beats localStorage, but only for the term it names", () => {
  const stored = {
    "2026-2027-1": ["PHYS101.01"],
    "2025-2026-2": ["HIST105.01"],
  };
  const resolved = resolveInitialSelection(
    stored,
    { semester: "2026-2027-1", courses: ["CMPE150.01"] },
    "2026-2027-1"
  );
  assert.deepEqual(resolved.selection["2026-2027-1"], ["CMPE150.01"]);
  // Other terms survive untouched, and `stored` itself is not mutated.
  assert.deepEqual(resolved.selection["2025-2026-2"], ["HIST105.01"]);
  assert.deepEqual(stored["2026-2027-1"], ["PHYS101.01"]);
});

test("localStorage wins when the URL carries no selection", () => {
  const stored = { "2026-2027-1": ["PHYS101.01"] };
  const resolved = resolveInitialSelection(
    stored,
    { semester: null, courses: [] },
    "2026-2027-1"
  );
  assert.equal(resolved.changed, false);
  assert.equal(resolved.selection, stored);
  assert.equal(resolved.semester, "2026-2027-1");
});

test("a share link identical to storage is not reported as a change", () => {
  const stored = { "2026-2027-1": ["CMPE150.01", "MATH101.02"] };
  const resolved = resolveInitialSelection(
    stored,
    { semester: "2026-2027-1", courses: ["MATH101.02", "CMPE150.01"] },
    "2026-2027-1"
  );
  assert.equal(resolved.changed, false);
});

test("unrelated query parameters survive strip and rebuild", () => {
  assert.equal(stripSelectionSearch("?d=2026-2027-1&c=CMPE150.01"), "");
  assert.equal(stripSelectionSearch("?utm=x&d=2026-2027-1&c=A"), "?utm=x");
  assert.equal(stripSelectionSearch(""), "");
  assert.equal(
    parseSelectionParams(buildSelectionSearch("?utm=x", "2026-2027-1", ["A"])).courses[0],
    "A"
  );
  assert.match(buildSelectionSearch("?utm=x", "2026-2027-1", ["A"]), /utm=x/);
});

test("popstate prefers the history snapshot over the query string", () => {
  const snapshot = encodeHistoryState("2026-2027-1", ["CMPE150.01"]);
  // The share-link entry has a stripped URL but a populated snapshot.
  const restored = decodeHistoryState(snapshot, "");
  assert.equal(restored.semester, "2026-2027-1");
  assert.deepEqual(restored.courses, ["CMPE150.01"]);

  // Entries we did not create (hand-typed URL) fall back to the query string.
  const fromUrl = decodeHistoryState(null, "?d=2025-2026-2&c=HIST105.01");
  assert.equal(fromUrl.semester, "2025-2026-2");
  assert.deepEqual(fromUrl.courses, ["HIST105.01"]);
  assert.deepEqual(decodeHistoryState({ other: 1 }, "?c=A").courses, ["A"]);
});

test("sameCourses ignores order and rejects real differences", () => {
  assert.equal(sameCourses(["A", "B"], ["B", "A"]), true);
  assert.equal(sameCourses([], null), true);
  assert.equal(sameCourses(["A"], ["A", "B"]), false);
  assert.equal(sameCourses(["A"], ["B"]), false);
});
