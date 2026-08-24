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
