import test from "node:test";
import assert from "node:assert/strict";
import { checkRoadmapPrereqs, termCredits, termEcts, sortTermsNewestFirst } from "../../../src/lib/roadmapLogic.mjs";

const prereqs = {
  CMPE210: { prereqs: ["CMPE150"] },
  CMPE300: { prereqs: ["CMPE210"] },
  DANGLING: { prereqs: ["GHOST101"] },
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
