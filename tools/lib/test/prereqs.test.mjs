import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  normalizeCourseCode,
  parseCourseList,
  parseDepartmentCodes,
  parsePrereqPage,
} from "../parse-prereqs.mjs";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function loadFixture(name) {
  return readFileSync(join(FIXTURES, name), "utf8");
}

test("normalizeCourseCode strips whitespace, entities and semicolons", () => {
  assert.equal(normalizeCourseCode("EC  101;"), "EC101");
  assert.equal(normalizeCourseCode("CHEM105&nbsp;"), "CHEM105");
  assert.equal(normalizeCourseCode("PHYS130;\u00a0"), "PHYS130");
  assert.equal(normalizeCourseCode("BM 4101"), "BM4101");
  assert.equal(normalizeCourseCode("cmpe 150"), "CMPE150");
});

test("normalizeCourseCode rejects non-course cells", () => {
  assert.equal(normalizeCourseCode("Prerequisite"), null);
  assert.equal(normalizeCourseCode(""), null);
  assert.equal(normalizeCourseCode("ME 212 (old)"), null);
});

test("parsePrereqPage extracts and normalizes prerequisites (EC 203)", () => {
  const result = parsePrereqPage(loadFixture("prerequisitecheck-ec203.html"));
  assert.deepEqual(result.prereqs, ["EC101"]);
  assert.deepEqual(result.coreqs, []);
  assert.equal(result.consent, false);
  assert.equal(result.gpa, null);
});

test("parsePrereqPage returns empty results for a not-Found page (CMPE 150)", () => {
  const result = parsePrereqPage(loadFixture("prerequisitecheck-cmpe150.html"));
  assert.deepEqual(result, { prereqs: [], coreqs: [], consent: false, gpa: null });
});

test("parsePrereqPage detects Consent of Instructor YES (CMPE 540)", () => {
  const result = parsePrereqPage(loadFixture("prerequisitecheck-cmpe540.html"));
  assert.deepEqual(result.prereqs, []);
  assert.equal(result.consent, true);
  // GPA Limit cell is "0" — no GPA requirement.
  assert.equal(result.gpa, null);
});

test("parsePrereqPage extracts multiple prereqs and coreqs with GPA limit", () => {
  // Modeled on the real ME 212 / consent-table markup observed live.
  const reqRow =
    "<tr><td width='50%'><font size=1>ME  212&nbsp;</td>" +
    "<td width='50%'><font size=1>__CODE__;&nbsp;</font></td></tr>";
  const html = `<!DOCTYPE html><html><body>
<p>Course Prerequisites:</p>
<table border=1><tr bgcolor=#6699CC><td>Course</td><td>Prerequisite</td></tr>
${reqRow.replaceAll("__CODE__", "CHEM105")}
${reqRow.replaceAll("__CODE__", "PHYS130")}
</table>
<p>GPA, Being Senior or Junior Student and Consent of Instructor Prerequisites:</p>
<table border=1>
<tr><td colspan=4></td><td>Consent Of Instructor</td></tr>
<tr><td>Course</td><td>GPA Limit</td><td>To Be Senior</td><td>To Be Junior</td><td>AND</td><td>OR</td></tr>
<tr><td>XX 400&nbsp;</td><td>3.00&nbsp;</td><td>NO&nbsp;</td><td>NO&nbsp;</td><td>NO&nbsp;</td><td>YES&nbsp;</td></tr>
<tr><td>XX 401&nbsp;</td><td>2.20&nbsp;</td><td>YES&nbsp;</td><td>NO&nbsp;</td><td>NO&nbsp;</td><td>NO&nbsp;</td></tr>
</table>
<p>Corequisites:</p>
<table border=1><tr bgcolor=#6699CC><td>Course</td><td>Corequisite</td></tr>
${reqRow.replaceAll("__CODE__", "ME 210")}
</table>
</body></html>`;
  const result = parsePrereqPage(html);
  assert.deepEqual(result.prereqs, ["CHEM105", "PHYS130"]);
  assert.deepEqual(result.coreqs, ["ME210"]);
  assert.equal(result.consent, true); // OR column YES on the XX 400 row
  assert.equal(result.gpa, "3.00"); // first positive GPA limit wins
});

test("parsePrereqPage tolerates a page with no recognizable sections", () => {
  assert.deepEqual(parsePrereqPage("<html><body>error</body></html>"), {
    prereqs: [],
    coreqs: [],
    consent: false,
    gpa: null,
  });
});

test("parseCourseList reads abbr+code pairs from an ects.asp page", () => {
  const courses = parseCourseList(loadFixture("ects-cmpe.html"));
  assert.ok(courses.length > 0);
  assert.deepEqual(courses[0], { abbr: "AS", code: "2003" });
  assert.ok(courses.some((c) => c.abbr === "BM" && c.code === "4101"));
  assert.deepEqual(
    courses.filter((c) => c.abbr === "CMPE").slice(0, 2),
    [
      { abbr: "CMPE", code: "100" },
      { abbr: "CMPE", code: "101" },
    ],
  );
  for (const { abbr, code } of courses) {
    assert.match(`${abbr}${code}`, /^[A-Z]+\d{3,4}[A-Z]?$/);
  }
});

test("parseDepartmentCodes collects bolum values from ectsdepsel.asp", () => {
  const html = `<html><body>
<td class="schtd"><a class="menu2" href="/scripts/ects.asp?bolum=CMPE">
<font style="font-size:11px">COMPUTER ENGINEERING</font></a></td>
<td class="schtd"><a class="menu2" href="/scripts/ects.asp?bolum=MATH">
<font style="font-size:11px">MATHEMATICS</font></a></td>
</body></html>`;
  assert.deepEqual(parseDepartmentCodes(html), ["CMPE", "MATH"]);
});
