import test from "node:test";
import assert from "node:assert/strict";
import {
  compareTerms,
  confidenceRank,
  nextTerm,
  parseTerm,
  predictOffering,
  predictedCourses,
  synthesiseFutureTerms,
  toDisplayKey,
  toFileKey,
} from "../../../src/lib/futureTerms.mjs";

/** Newest term BOUN has published, as of the fixtures below. */
const HORIZON = "2026/2027-1";

test("synthesised terms roll over the academic year", () => {
  assert.deepEqual(synthesiseFutureTerms("2026/2027-3", 2), [
    "2027/2028-1",
    "2027/2028-2",
  ]);
  assert.equal(nextTerm("2026/2027-3"), "2027/2028-1");
  // The separator of the input is preserved, so file keys stay file keys.
  assert.equal(nextTerm("2026-2027-3"), "2027-2028-1");
});

test("a full board of upcoming terms follows the newest published one", () => {
  assert.deepEqual(synthesiseFutureTerms("2026/2027-1", 6), [
    "2026/2027-2",
    "2026/2027-3",
    "2027/2028-1",
    "2027/2028-2",
    "2027/2028-3",
    "2028/2029-1",
  ]);
});

test("synthesis refuses anything that is not a term key", () => {
  assert.deepEqual(synthesiseFutureTerms("not-a-term", 3), []);
  // The two years must be consecutive.
  assert.deepEqual(synthesiseFutureTerms("2026/2028-1", 3), []);
  assert.deepEqual(synthesiseFutureTerms("2026/2027-4", 3), []);
  assert.deepEqual(synthesiseFutureTerms("2026/2027-1", 0), []);
  assert.equal(parseTerm("2026/2027-1")?.ordinal, 6078);
  assert.equal(parseTerm("garbage"), null);
});

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
  // Non-term keys still produce a total order instead of throwing.
  assert.deepEqual(["2026/2027-1", "zzz", "aaa"].sort(compareTerms), [
    "aaa",
    "zzz",
    "2026/2027-1",
  ]);
});

test("term keys convert between file and display form", () => {
  assert.equal(toFileKey("2026/2027-1"), "2026-2027-1");
  assert.equal(toDisplayKey("2026-2027-1"), "2026/2027-1");
  assert.equal(toFileKey("2026-2027-1"), "2026-2027-1");
  assert.equal(toDisplayKey("garbage"), "garbage");
});

test("a course listed in a published term is known, not predicted", () => {
  const p = predictOffering(["2025-2026-1", "2026-2027-1"], "2026/2027-1", {
    horizonTerm: HORIZON,
  });
  assert.equal(p.known, true);
  assert.equal(p.confidence, "known");
  assert.equal(p.likely, true);
  assert.ok(confidenceRank("known") > confidenceRank("high"));
});

test("an 'every' pattern course is high confidence next Fall", () => {
  const every = [
    "2024-2025-1",
    "2024-2025-2",
    "2025-2026-1",
    "2025-2026-2",
    "2026-2027-1",
  ];
  const p = predictOffering(every, "2027/2028-1", { horizonTerm: HORIZON });
  assert.equal(p.pattern, "every");
  assert.equal(p.seasonCount, 3);
  assert.equal(p.coverage, 1);
  assert.equal(p.yearsSinceLast, 1);
  assert.equal(p.confidence, "high");
  assert.equal(p.likely, true);
  assert.equal(p.known, false);
});

test("a 'yearly' Fall course is likely next Fall and never claimed for Spring", () => {
  const fallOnly = [
    "2022-2023-1",
    "2023-2024-1",
    "2024-2025-1",
    "2025-2026-1",
    "2026-2027-1",
  ];
  const fall = predictOffering(fallOnly, "2027/2028-1", { horizonTerm: HORIZON });
  assert.equal(fall.pattern, "yearly");
  assert.equal(fall.confidence, "high");
  assert.equal(fall.likely, true);
  assert.equal(fall.lastSeasonTerm, "2026-2027-1");

  const spring = predictOffering(fallOnly, "2027/2028-2", {
    horizonTerm: HORIZON,
  });
  assert.equal(spring.seasonCount, 0);
  assert.deepEqual(spring.seasons, [1]);
  assert.equal(spring.confidence, "none");
  assert.equal(spring.likely, false);
  assert.equal(spring.yearsSinceLast, null);
});

test("a 'sparse' course last seen years ago is not presented as likely", () => {
  const stale = ["2018-2019-1", "2020-2021-1"];
  const p = predictOffering(stale, "2027/2028-1", { horizonTerm: HORIZON });
  assert.equal(p.pattern, "sparse");
  assert.equal(p.seasonCount, 2);
  assert.equal(p.yearsSinceLast, 7);
  assert.ok(p.coverage < 0.3, `coverage ${p.coverage} should be small`);
  assert.equal(p.confidence, "low");
  assert.equal(p.likely, false);
});

test("two recent Summers earn medium, not high", () => {
  const p = predictOffering(["2025-2026-3", "2026-2027-3"], "2027/2028-3", {
    horizonTerm: "2026/2027-3",
  });
  assert.equal(p.seasonCount, 2);
  assert.equal(p.yearsSinceLast, 1);
  assert.equal(p.confidence, "medium");
  assert.equal(p.likely, true);
});

test("one skipped year does not demote a course offered nearly every Spring", () => {
  // termHistory calls this "sparse" because of the missing 2024 Spring;
  // coverage (8 of the 10 years observed) keeps the verdict honest.
  const springs = [
    "2017-2018-2",
    "2018-2019-2",
    "2019-2020-2",
    "2020-2021-2",
    "2021-2022-2",
    "2022-2023-2",
    "2023-2024-2",
    "2025-2026-2",
  ];
  const p = predictOffering(springs, "2026/2027-2", { horizonTerm: HORIZON });
  assert.equal(p.seasonPattern, "sparse");
  assert.equal(p.seasonCount, 8);
  assert.equal(p.coverage, 0.8);
  assert.equal(p.confidence, "high");
  assert.equal(p.likely, true);
});

test("prediction ignores malformed archive entries", () => {
  const p = predictOffering(
    ["bogus", "2025-2026-1", "2026-2027-1", "2026/2027-1"],
    "2027/2028-1",
    { horizonTerm: HORIZON },
  );
  // "2026/2027-1" is the same term in display form, counted once per entry.
  assert.equal(p.count, 3);
  assert.equal(p.lastTerm, "2026-2027-1");
  assert.equal(predictOffering(null, "2027/2028-1").confidence, "none");
  assert.equal(predictOffering([], "2027/2028-1").count, 0);
});

test("predictedCourses ranks by evidence and honours prefix and limit", () => {
  const offerings = {
    CMPE150: ["2024-2025-1", "2025-2026-1", "2026-2027-1"],
    CMPE250: ["2018-2019-1", "2020-2021-1"],
    CMPE300: [],
    MATH101: ["2024-2025-1", "2025-2026-1", "2026-2027-1"],
  };
  const out = predictedCourses(offerings, "2027/2028-1", {
    horizonTerm: HORIZON,
    prefix: "cmpe",
  });
  assert.deepEqual(
    out.map((x) => x.code),
    ["CMPE150", "CMPE250"],
  );
  assert.equal(out[0].prediction.confidence, "high");
  assert.equal(out[1].prediction.confidence, "low");
  assert.equal(
    predictedCourses(offerings, "2027/2028-1", { limit: 1 }).length,
    1,
  );
  assert.deepEqual(predictedCourses(null, "2027/2028-1"), []);
});
