import test from "node:test";
import assert from "node:assert/strict";
import { compareTerms, sortTermsNewestFirst } from "../../../src/lib/termKeys.mjs";

test("compareTerms is chronological where string order lies", () => {
  // "-" (U+002D) sorts before "/" (U+002F): as soon as display-form and
  // file-form keys share a list, string order claims Fall 2026 is the newer of
  // the two, and it is the older.
  assert.ok("2026/2027-1" > "2026-2027-3");
  assert.ok(compareTerms("2026/2027-1", "2026-2027-3") < 0);

  const mixed = ["2027-2028-1", "2026/2027-1", "2026-2027-3", "2026/2027-2"];
  assert.deepEqual([...mixed].sort(compareTerms), [
    "2026/2027-1",
    "2026/2027-2",
    "2026-2027-3",
    "2027-2028-1",
  ]);
});

test("compareTerms still totally orders keys that are not terms", () => {
  assert.deepEqual(["2026/2027-1", "zzz", "aaa"].sort(compareTerms), [
    "aaa",
    "zzz",
    "2026/2027-1",
  ]);
  // The two years must be consecutive and the season must be 1-3, so these are
  // not terms and sort with the junk rather than by their digits.
  assert.deepEqual(["2026/2027-1", "2026/2028-1", "2026/2027-4"].sort(compareTerms), [
    "2026/2027-4",
    "2026/2028-1",
    "2026/2027-1",
  ]);
});

test("sortTermsNewestFirst orders YYYY/YYYY-T descending", () => {
  assert.deepEqual(
    sortTermsNewestFirst(["2024/2025-1", "2026/2027-1", "2025/2026-2"]),
    ["2026/2027-1", "2025/2026-2", "2024/2025-1"],
  );
});

test("sortTermsNewestFirst stays chronological across both key forms", () => {
  // The instructor panel's history window merges semesters.json (display form)
  // with keys derived from data filenames (file form), so this is the real
  // input shape, not a contrived one.
  assert.deepEqual(
    sortTermsNewestFirst([
      "2026/2027-1",
      "2025/2026-2",
      "2026-2027-2",
      "2026-2027-3",
    ]),
    ["2026-2027-3", "2026-2027-2", "2026/2027-1", "2025/2026-2"],
  );
});

test("sortTermsNewestFirst does not mutate its input", () => {
  const terms = ["2024/2025-1", "2026/2027-1"];
  sortTermsNewestFirst(terms);
  assert.deepEqual(terms, ["2024/2025-1", "2026/2027-1"]);
});
