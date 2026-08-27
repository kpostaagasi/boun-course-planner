import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { parseSchedulePage, parseDepartmentList } from "../parse.mjs";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

function loadFixture(name) {
  return readFileSync(path.join(FIXTURES, name), "utf8");
}

test("parses the current layout (with Quota column)", () => {
  const html = loadFixture("sch-2026-2027-1-cmpe.html");
  const { sections, warnings } = parseSchedulePage(html, { kisaadi: "CMPE" });

  assert.equal(warnings.length, 0);
  assert.equal(sections.size, 107);

  // Main entry keeps only the lecture meetings.
  assert.deepEqual(sections.get("CMPE150.01").entry, {
    code: "CMPE150.01",
    credits: 3,
    days: ["T"],
    dept: ["CMPE"],
    ects: 5,
    hours: [8],
    instructor: "EMRE UĞUR",
    name: "INTRODUCTION TO COMPUTING",
    rooms: ["EF 06"],
  });

  // LAB / P.S. rows become separate numbered entries.
  const lab = sections.get("CMPE150.01 LAB 1").entry;
  assert.deepEqual(lab.days, ["F", "F"]);
  assert.deepEqual(lab.hours, [1, 2]);
  assert.equal(lab.name, "INTRODUCTION TO COMPUTING LAB");
  assert.equal(lab.code, "CMPE150.01");
  assert.ok(!("credits" in lab));

  // "Required for Dept.(*)" column parses into a code list.
  assert.deepEqual(sections.get("CMPE150.03").entry.requiredForDept, ["CE", "ME"]);
  assert.ok(!("requiredForDept" in sections.get("CMPE101.01").entry));
});

test("parses the archived layout (without Quota column)", () => {
  const html = loadFixture("sch-2025-2026-1-cmpe.html");
  const { sections, warnings } = parseSchedulePage(html, { kisaadi: "CMPE" });

  assert.equal(warnings.length, 0);
  assert.ok(sections.size > 50);

  // Two-digit slots survive the concatenation ("WWW" + "8910").
  const evening = sections.get("CMPE58C.01").entry;
  assert.deepEqual(evening.days, ["W", "W", "W"]);
  assert.deepEqual(evening.hours, [8, 9, 10]);

  assert.deepEqual(sections.get("CMPE220.01").entry.days, ["W", "W", "Th"]);
  assert.deepEqual(sections.get("CMPE220.01").entry.hours, [7, 8, 8]);
});

test("captures the exam / delivery columns when the source has them", () => {
  // Real capture of /scripts/sch.asp?donem=2021/2022-1&kisaadi=EC — the only
  // sampled layout where all four sparse columns are populated at once
  // (delivery method was filled during the 2020-2022 online terms).
  const html = loadFixture("sch-2021-2022-1-ec.html");
  const { sections, warnings } = parseSchedulePage(html, { kisaadi: "EC" });

  assert.equal(warnings.length, 0);

  const ec101 = sections.get("EC101.01").entry;
  assert.equal(ec101.deliveryMethod, "Classroom");
  assert.equal(ec101.finalExamLocation, "Classroom");
  assert.equal(ec101.examDate, "10.01.2022");
  assert.equal(ec101.examSlot, "1");

  // Hybrid delivery keeps the raw "Online/Classroom" wording.
  assert.equal(sections.get("EC101.04").entry.deliveryMethod, "Online/Classroom");

  // Keys stay alphabetical, so the new fields land in sorted position.
  assert.deepEqual(Object.keys(ec101), [
    "code",
    "credits",
    "days",
    "deliveryMethod",
    "dept",
    "ects",
    "examDate",
    "examSlot",
    "finalExamLocation",
    "hours",
    "instructor",
    "name",
    "requiredForDept",
    "rooms",
  ]);
});

test("exam date and slot parse on the archived layout", () => {
  // 2025-2026-1 has the exam schedule published but no delivery method and no
  // final-exam location, so the two absent columns must not leave empty keys.
  const html = loadFixture("sch-2025-2026-1-cmpe.html");
  const { sections } = parseSchedulePage(html, { kisaadi: "CMPE" });

  const entry = sections.get("CMPE150.01").entry;
  assert.equal(entry.examDate, "30.12.2025");
  assert.equal(entry.examSlot, "1");
  assert.ok(!("deliveryMethod" in entry));
  assert.ok(!("finalExamLocation" in entry));

  // LAB / P.S. rows carry a filler "Sl." of 0 and no exam date; the exam
  // belongs to the parent section, so they must stay clean.
  const lab = sections.get("CMPE150.01 LAB 1").entry;
  assert.ok(!("examSlot" in lab));
  assert.ok(!("examDate" in lab));
});

test("empty exam / delivery cells produce absent keys, not empty strings", () => {
  // 2026-2027-1 is a future term: the exam schedule is not published yet and
  // all four columns are blank across every row.
  const html = loadFixture("sch-2026-2027-1-cmpe.html");
  const { sections } = parseSchedulePage(html, { kisaadi: "CMPE" });

  for (const field of ["deliveryMethod", "finalExamLocation", "examDate", "examSlot"]) {
    const withField = [...sections.values()].filter(({ entry }) => field in entry);
    assert.equal(withField.length, 0, `${field} should be absent on every section`);
  }
});

test("header missing the exam columns fails loudly", () => {
  const html = `
    <table>
      <tr class="schtitle">
        <td>Code.Sec</td><td>Name</td><td>Cr.</td><td>Ects</td><td>Instr.</td>
        <td>Days</td><td>Hours</td><td>Rooms</td><td>Required for Dept.(*)</td>
      </tr>
      <tr class="schtd"><td>CMPE101.01</td><td>X</td><td>3</td><td>5</td><td>Y</td><td>M</td><td>1</td><td>Z</td><td></td></tr>
    </table>`;
  assert.throws(() => parseSchedulePage(html), /Schedule header missing "deliveryMethod"/);
});

test("missing header row fails loudly instead of producing junk", () => {
  assert.throws(
    () => parseSchedulePage("<html><body><table><tr class='schtd'><td>x</td></tr></table></body></html>"),
    /No schedule table header row/,
  );
});

test("header missing a required column fails loudly", () => {
  const html = `
    <table>
      <tr class="schtitle"><td>Code.Sec</td><td>Name</td><td>Days</td></tr>
      <tr class="schtd"><td>CMPE101.01</td><td>X</td><td>M</td></tr>
    </table>`;
  assert.throws(() => parseSchedulePage(html), /Schedule header missing/);
});

test("parseDepartmentList extracts department codes and names", () => {
  const html = loadFixture("sch-2026-2027-1-cmpe.html");
  // The schedule page has no department links; use a minimal synthetic list.
  const listHtml = `
    <a href="/scripts/sch.asp?donem=&amp;kisaadi=CMPE&amp;bolum=COMPUTER+ENGINEERING">x</a>
    <a href="/scripts/sch.asp?donem=&amp;kisaadi=AD&amp;bolum=MANAGEMENT">y</a>
    <a href="/scripts/sch.asp?donem=&amp;kisaadi=CMPE&amp;bolum=COMPUTER+ENGINEERING">dup</a>`;
  const departments = parseDepartmentList(listHtml);

  assert.equal(departments.length, 2);
  assert.deepEqual(departments[0], { kisaadi: "CMPE", bolum: "COMPUTER ENGINEERING" });
  assert.deepEqual(departments[1], { kisaadi: "AD", bolum: "MANAGEMENT" });
});
