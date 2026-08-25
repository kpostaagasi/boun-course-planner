import test from "node:test";
import assert from "node:assert/strict";
import { buildPaletteEntries, searchPalette } from "../../../src/lib/paletteSearch.mjs";

const semesterData = {
  "CMPE210.01": { code: "CMPE  210.01", name: "DATA STRUCTURES", instructor: "TANER ESKIN" },
  "CMPE150.02": { code: "CMPE  150.02", name: "INTRODUCTION TO COMPUTING", instructor: "AYŞE KARATAŞ" },
  "MATH101.01": { code: "MATH 101.01", name: "CALCULUS I", instructor: "METİN ERCAN" },
  "EE210.01": { code: "EE 210.01", name: "SIGNALS AND SYSTEMS", instructor: "CMPE GUEST" },
};

test("buildPaletteEntries flattens and normalizes base codes", () => {
  const entries = buildPaletteEntries(semesterData);
  const cmpe = entries.find((e) => e.courseName === "CMPE210.01");
  assert.equal(cmpe.code, "CMPE210");
  assert.equal(cmpe.title, "DATA STRUCTURES");
  assert.equal(cmpe.instructor, "TANER ESKIN");
});

test("buildPaletteEntries tolerates null data", () => {
  assert.deepEqual(buildPaletteEntries(null), []);
});

test("searchPalette returns empty for blank query", () => {
  const entries = buildPaletteEntries(semesterData);
  assert.deepEqual(searchPalette(entries, ""), []);
  assert.deepEqual(searchPalette(entries, "   "), []);
});

test("exact code match outranks prefix", () => {
  const entries = buildPaletteEntries(semesterData);
  const results = searchPalette(entries, "cmpe210");
  assert.equal(results[0].code, "CMPE210");
});

test("code prefix ranks before unrelated substring match", () => {
  const entries = buildPaletteEntries(semesterData);
  const results = searchPalette(entries, "cmpe1");
  // CMPE150 matches by code; CMPE210 does not contain "cmpe1"
  assert.deepEqual(results.map((e) => e.code), ["CMPE150"]);
});

test("falls back to title search when no code matches", () => {
  const entries = buildPaletteEntries(semesterData);
  const results = searchPalette(entries, "calculus");
  assert.equal(results.length, 1);
  assert.equal(results[0].code, "MATH101");
});

test("matches instructor field", () => {
  const entries = buildPaletteEntries(semesterData);
  const results = searchPalette(entries, "ercan");
  assert.equal(results[0].code, "MATH101");
});

test("respects limit", () => {
  const entries = buildPaletteEntries(semesterData);
  const results = searchPalette(entries, "0", 2); // all codes contain "0" except none... EE210, MATH101, CMPE210, CMPE150
  assert.ok(results.length <= 2);
});

test("no match yields empty list", () => {
  const entries = buildPaletteEntries(semesterData);
  assert.deepEqual(searchPalette(entries, "zzzz"), []);
});
