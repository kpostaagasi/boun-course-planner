import test from "node:test";
import assert from "node:assert/strict";
import {
  ECTS_OVERLOAD_THRESHOLD,
  checkRoadmapPrereqs,
  courseCatalog,
  termCredits,
  termEcts,
  termLoad,
  sortTermsNewestFirst,
} from "../../../src/lib/roadmapLogic.mjs";
import { synthesiseFutureTerms } from "../../../src/lib/futureTerms.mjs";

const prereqs = {
  CMPE210: { prereqs: ["CMPE150"] },
  CMPE300: { prereqs: ["CMPE210"] },
  DANGLING: { prereqs: ["GHOST101"] },
};

// Same chain, but every code is known, so nothing is dismissed as dangling.
const chainPrereqs = {
  CMPE150: { prereqs: [] },
  CMPE210: { prereqs: ["CMPE150"] },
  CMPE300: { prereqs: ["CMPE210"] },
};

test("prereq satisfied by an earlier roadmap term", () => {
  const roadmap = { "2026-2027-1": ["CMPE150"], "2026-2027-2": ["CMPE210"] };
  const r = checkRoadmapPrereqs(roadmap, ["2026-2027-1", "2026-2027-2"], new Set(), prereqs);
  assert.equal(r["2026-2027-2"]["CMPE210"].ok, true);
});

test("prereq unmet when taught in the SAME term or later", () => {
  const roadmap = { "2026-2027-1": ["CMPE210"], "2026-2027-2": ["CMPE150"] };
  const r = checkRoadmapPrereqs(roadmap, ["2026-2027-1", "2026-2027-2"], new Set(), prereqs);
  assert.equal(r["2026-2027-1"]["CMPE210"].ok, false);
  assert.deepEqual(r["2026-2027-1"]["CMPE210"].missing, ["CMPE150"]);
});

test("prereq satisfied by completed set (feature A)", () => {
  const roadmap = { "2026-2027-2": ["CMPE210"] };
  const r = checkRoadmapPrereqs(roadmap, ["2026-2027-2"], new Set(["CMPE150"]), prereqs);
  assert.equal(r["2026-2027-2"]["CMPE210"].ok, true);
});

test("dangling prereq references are ignored", () => {
  const roadmap = { "2026-2027-1": ["DANGLING"] };
  const r = checkRoadmapPrereqs(roadmap, ["2026-2027-1"], new Set(), prereqs);
  assert.equal(r["2026-2027-1"]["DANGLING"].ok, true);
});

test("termCredits sums credits from term data", () => {
  const termData = { "CMPE150.01": { credits: "3" }, "MATH101.01": { credits: "4" } };
  assert.equal(termCredits("2026-2027-1", { "2026-2027-1": ["CMPE150", "MATH101"] }, termData), 7);
});

test("termCredits counts unknown courses as 0", () => {
  assert.equal(termCredits("t", { t: ["NOPE101"] }, {}), 0);
});

test("termEcts sums ects from term data", () => {
  const termData = { "CMPE150.01": { ects: "5" }, "MATH101.01": { ects: 6 } };
  assert.equal(termEcts("2026-2027-1", { "2026-2027-1": ["CMPE150", "MATH101"] }, termData), 11);
});

test("termEcts counts unknown courses as 0", () => {
  assert.equal(termEcts("t", { t: ["NOPE101"] }, {}), 0);
});

test("sortTermsNewestFirst orders YYYY/YYYY-T descending", () => {
  assert.deepEqual(
    sortTermsNewestFirst(["2024/2025-1", "2026/2027-1", "2025/2026-2"]),
    ["2026/2027-1", "2025/2026-2", "2024/2025-1"],
  );
});

test("a prereq chain spanning two synthesised future terms is satisfied", () => {
  const future = synthesiseFutureTerms("2026/2027-1", 3);
  assert.deepEqual(future, ["2026/2027-2", "2026/2027-3", "2027/2028-1"]);
  const ordered = ["2026/2027-1", ...future];
  const roadmap = {
    "2026/2027-1": ["CMPE150"],
    "2026/2027-3": ["CMPE210"],
    "2027/2028-1": ["CMPE300"],
  };
  const r = checkRoadmapPrereqs(roadmap, ordered, new Set(), chainPrereqs);
  assert.equal(r["2026/2027-3"]["CMPE210"].ok, true);
  assert.equal(r["2027/2028-1"]["CMPE300"].ok, true);
});

test("a prereq scheduled in a later synthesised term is flagged", () => {
  const ordered = ["2026/2027-1", ...synthesiseFutureTerms("2026/2027-1", 3)];
  const roadmap = {
    "2026/2027-2": ["CMPE300"],
    "2027/2028-1": ["CMPE210", "CMPE150"],
  };
  const r = checkRoadmapPrereqs(roadmap, ordered, new Set(), chainPrereqs);
  assert.equal(r["2026/2027-2"]["CMPE300"].ok, false);
  assert.deepEqual(r["2026/2027-2"]["CMPE300"].missing, ["CMPE210"]);
  // CMPE150 shares the term with CMPE210, so it does not satisfy it either.
  assert.equal(r["2027/2028-1"]["CMPE210"].ok, false);
  assert.deepEqual(r["2027/2028-1"]["CMPE210"].missing, ["CMPE150"]);
});

test("courseCatalog keeps the first dataset that states each field", () => {
  const catalog = courseCatalog([
    { "CMPE150.01": { name: "Intro" }, "CMPE150.02": { credits: "3", ects: "6" } },
    { "CMPE150.01": { name: "Old name", credits: "4", ects: "8" } },
  ]);
  assert.deepEqual(catalog.CMPE150, { name: "Intro", credits: 3, ects: 6 });
});

test("credits and ECTS for a term with no data come from the newest known offering", () => {
  const currentTerm = { "CMPE150.01": { name: "Intro", credits: "3", ects: "6" } };
  const olderTerm = {
    "CMPE150.01": { name: "Intro", credits: "4", ects: "8" },
    "MATH101.01": { credits: "4", ects: "7" },
  };
  // Newest dataset first: it wins wherever it states a field.
  const catalog = courseCatalog([currentTerm, olderTerm]);
  const future = synthesiseFutureTerms("2026/2027-1", 1)[0];
  const roadmap = { [future]: ["CMPE150", "MATH101", "GHOST101"] };
  const load = termLoad(future, roadmap, catalog);
  assert.equal(load.credits, 7);
  assert.equal(load.ects, 13);
  assert.equal(load.overload, false);
});

test("ECTS above the threshold is an overload, exactly at it is not", () => {
  assert.equal(ECTS_OVERLOAD_THRESHOLD, 40);
  const term = "2027/2028-1";
  const catalog = courseCatalog([
    { "A1.01": { ects: 20 }, "A2.01": { ects: 20 }, "A3.01": { ects: 1 } },
  ]);
  const atThreshold = termLoad(term, { [term]: ["A1", "A2"] }, catalog);
  assert.equal(atThreshold.ects, 40);
  assert.equal(atThreshold.overload, false);
  const over = termLoad(term, { [term]: ["A1", "A2", "A3"] }, catalog);
  assert.equal(over.ects, 41);
  assert.equal(over.overload, true);
});

test("sortTermsNewestFirst stays chronological with synthesised keys mixed in", () => {
  const published = ["2026/2027-1", "2025/2026-2"];
  const synthesised = synthesiseFutureTerms("2026-2027-1", 2);
  assert.deepEqual(synthesised, ["2026-2027-2", "2026-2027-3"]);
  assert.deepEqual(sortTermsNewestFirst([...published, ...synthesised]), [
    "2026-2027-3",
    "2026-2027-2",
    "2026/2027-1",
    "2025/2026-2",
  ]);
  // Plain string comparison gets this wrong, which is why it is not used.
  assert.ok("2026/2027-1" > "2026-2027-3");
});
