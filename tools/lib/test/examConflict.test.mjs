import test from "node:test";
import assert from "node:assert/strict";
import {
  examConflictFor,
  examConflicts,
  parseExamDate,
  parseExamSlot,
} from "../../../src/lib/examConflict.mjs";

test("parseExamDate reads the DD.MM.YYYY format the registrar actually emits", () => {
  // Measured from the archived schedule fixtures: 10.01.2022, 19.01.2022, 30.12.2025.
  assert.equal(parseExamDate("10.01.2022"), "2022-01-10");
  assert.equal(parseExamDate("30.12.2025"), "2025-12-30");
  assert.equal(parseExamDate(" 7.1.2022 "), "2022-01-07");
  assert.equal(parseExamDate("10/01/2022"), "2022-01-10");
  assert.equal(parseExamDate("2022-01-10"), "2022-01-10");
});

test("parseExamDate refuses anything it cannot prove is a date", () => {
  for (const raw of ["", "   ", "TBA", "Ocak", "99.99.9999", "31.02.2022", "10.01.22", undefined, null]) {
    assert.equal(parseExamDate(raw), null, `should not parse ${JSON.stringify(raw)}`);
  }
});

test("parseExamSlot reads the small integers the Sl. column holds", () => {
  assert.equal(parseExamSlot("1"), 1);
  assert.equal(parseExamSlot(" 3 "), 3);
  assert.equal(parseExamSlot(2), 2);
  assert.equal(parseExamSlot("0"), null);
  assert.equal(parseExamSlot("AM"), null);
  assert.equal(parseExamSlot(""), null);
  assert.equal(parseExamSlot(undefined), null);
});

test("same date and same session is a reported clash", () => {
  const report = examConflicts([
    { key: "CMPE150.01", examDate: "10.01.2022", examSlot: "1" },
    { key: "MATH101.03", examDate: "10.01.2022", examSlot: "1" },
  ]);
  assert.deepEqual(report.conflicts, [
    { a: "CMPE150.01", b: "MATH101.03", date: "2022-01-10", slot: 1 },
  ]);
  assert.deepEqual(report.unresolved, []);
  assert.deepEqual(report.unknown, []);
});

test("same date, different session is genuinely no clash", () => {
  const report = examConflicts([
    { key: "CMPE150.01", examDate: "10.01.2022", examSlot: "1" },
    { key: "MATH101.03", examDate: "10.01.2022", examSlot: "3" },
  ]);
  assert.deepEqual(report.conflicts, []);
  assert.deepEqual(report.unresolved, []);
  assert.deepEqual(report.unknown, []);
  assert.equal(examConflictFor("CMPE150.01", [
    { key: "CMPE150.01", examDate: "10.01.2022", examSlot: "1" },
    { key: "MATH101.03", examDate: "10.01.2022", examSlot: "3" },
  ]).status, "clear");
});

test("different dates never clash, whatever the sessions say", () => {
  const report = examConflicts([
    { key: "CMPE150.01", examDate: "10.01.2022", examSlot: "1" },
    { key: "MATH101.03", examDate: "11.01.2022", examSlot: "1" },
  ]);
  assert.deepEqual(report.conflicts, []);
  assert.deepEqual(report.unresolved, []);
});

test("an unparseable date yields unknown, never a silent no-conflict", () => {
  const sections = [
    { key: "CMPE150.01", examDate: "10.01.2022", examSlot: "1" },
    { key: "MATH101.03", examDate: "belirlenecek", examSlot: "1" },
  ];
  const report = examConflicts(sections);
  assert.deepEqual(report.conflicts, []);
  assert.deepEqual(report.unknown, ["MATH101.03"]);

  // The readable side must NOT be told it is in the clear: the garbage date
  // could be 10.01.2022 for all we know.
  const status = examConflictFor("CMPE150.01", sections);
  assert.equal(status.status, "unknown");
  assert.notEqual(status.status, "clear");
  // And the unreadable side knows nothing about itself either.
  assert.equal(examConflictFor("MATH101.03", sections).status, "unknown");
});

test("a missing session on a shared date is unresolved, not decided either way", () => {
  const sections = [
    { key: "CMPE150.01", examDate: "10.01.2022", examSlot: "1" },
    { key: "MATH101.03", examDate: "10.01.2022" },
  ];
  const report = examConflicts(sections);
  assert.deepEqual(report.conflicts, []);
  assert.deepEqual(report.unresolved, [
    { a: "CMPE150.01", b: "MATH101.03", date: "2022-01-10" },
  ]);
  assert.deepEqual(report.unknown, []);

  const status = examConflictFor("CMPE150.01", sections);
  assert.equal(status.status, "maybe");
  assert.deepEqual(status.with, ["MATH101.03"]);
});

test("a definite clash outranks an unresolved pair in the per-card status", () => {
  const sections = [
    { key: "CMPE150.01", examDate: "10.01.2022", examSlot: "1" },
    { key: "MATH101.03", examDate: "10.01.2022", examSlot: "1" },
    { key: "PHYS101.02", examDate: "10.01.2022" },
  ];
  const status = examConflictFor("CMPE150.01", sections);
  assert.equal(status.status, "clash");
  assert.deepEqual(status.with, ["MATH101.03"]);
  assert.equal(status.compared, 2);
});

test("three sections produce every distinct pair exactly once", () => {
  const report = examConflicts([
    { key: "A.01", examDate: "10.01.2022", examSlot: "2" },
    { key: "B.01", examDate: "10.01.2022", examSlot: "2" },
    { key: "C.01", examDate: "10.01.2022", examSlot: "2" },
  ]);
  assert.equal(report.conflicts.length, 3);
  assert.deepEqual(
    report.conflicts.map((c) => `${c.a}|${c.b}`),
    ["A.01|B.01", "A.01|C.01", "B.01|C.01"],
  );
});

test("a section absent from the comparison set reports unknown about itself", () => {
  const status = examConflictFor("CMPE150.01", [
    { key: "MATH101.03", examDate: "10.01.2022", examSlot: "1" },
  ]);
  assert.equal(status.status, "unknown");
  assert.equal(status.compared, 1);
});

test("nothing to compare against still needs readable exam data to be clear", () => {
  assert.equal(
    examConflictFor("CMPE150.01", [{ key: "CMPE150.01", examDate: "10.01.2022", examSlot: "1" }])
      .status,
    "clear",
  );
  // …and the card gates on `compared`, which is 0 here.
  assert.equal(
    examConflictFor("CMPE150.01", [{ key: "CMPE150.01", examDate: "10.01.2022", examSlot: "1" }])
      .compared,
    0,
  );
  assert.equal(examConflictFor("CMPE150.01", [{ key: "CMPE150.01" }]).status, "unknown");
});
