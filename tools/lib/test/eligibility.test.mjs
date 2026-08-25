import test from "node:test";
import assert from "node:assert/strict";
import { getEligibility } from "../../../src/lib/eligibility.mjs";

const prereqs = {
  CMPE210: { prereqs: ["CMPE150"] },
  CMPE300: { prereqs: ["CMPE210", "MATH202"] },
  MATH202: { prereqs: [] },
  SOC999: { prereqs: ["SOC101"] }, // dangling: SOC101 not in prereqs map
};

test("taken when code is in completed set", () => {
  assert.deepEqual(getEligibility("CMPE210", new Set(["CMPE210"]), prereqs), {
    status: "taken", missing: [], moreMissing: false,
  });
});

test("eligible when all prereqs completed", () => {
  assert.deepEqual(getEligibility("CMPE210", new Set(["CMPE150"]), prereqs).status, "eligible");
});

test("missing-prereq lists unmet prereqs", () => {
  const r = getEligibility("CMPE300", new Set(["CMPE150"]), prereqs);
  assert.equal(r.status, "missing-prereq");
  assert.deepEqual(r.missing.sort(), ["CMPE210", "MATH202"]);
});

test("eligible ignores dangling prereq references", () => {
  assert.equal(getEligibility("SOC999", new Set(), prereqs).status, "eligible");
});

test("no-data when prereqs map lacks the code", () => {
  assert.equal(getEligibility("MATH101", new Set(), prereqs).status, "no-data");
});

test("no-data when prereqs map is null", () => {
  assert.equal(getEligibility("CMPE210", new Set(), null).status, "no-data");
});

test("missing list capped at 3 with moreMissing flag", () => {
  const many = { X: { prereqs: ["A", "B", "C", "D", "E"] }, A: { prereqs: [] }, B: { prereqs: [] }, C: { prereqs: [] }, D: { prereqs: [] }, E: { prereqs: [] } };
  const r = getEligibility("X", new Set(), many);
  assert.equal(r.missing.length, 3);
  assert.equal(r.moreMissing, true);
});
