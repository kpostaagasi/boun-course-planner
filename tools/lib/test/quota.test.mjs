import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { parseQuotaPage } from "../parse-quota.mjs";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

/** @param {string} name */
function loadFixture(name) {
  return readFileSync(join(FIXTURES, name), "utf8");
}

test("parses capacity and departmental rows (MATH 101.01)", () => {
  // Real capture: /scripts/quotasearch.asp?abbr=MATH&code=101&section=01&donem=2026/2027-1
  const page = parseQuotaPage(loadFixture("quotasearch-math101-01.html"), "MATH101.01");

  assert.equal(page.cap, 195);
  assert.deepEqual(page.rows, [{ dept: "ALL", status: "ALL", quota: 100, current: 134 }]);
  assert.deepEqual(page.surname, []);
  assert.deepEqual(page.warnings, []);

  // "Current" is the live enrolled count, so this section is over-enrolled
  // against its departmental allocation but still inside the room capacity.
  const [row] = page.rows;
  assert.ok(row.current > row.quota);
  assert.ok(row.current < /** @type {number} */ (page.cap));
});

test("parses a capacity-only page with no quota tables (CMPE 150.01)", () => {
  // Real capture: same endpoint, abbr=CMPE&code=150&section=01. The page still
  // emits its two empty trailer tables; they must not become phantom rows.
  const page = parseQuotaPage(loadFixture("quotasearch-cmpe150-01.html"), "CMPE150.01");

  assert.equal(page.cap, 110);
  assert.deepEqual(page.rows, []);
  assert.deepEqual(page.surname, []);
  assert.deepEqual(page.warnings, []);
});

test("a page with no capacity block at all is valid, not a failure (AD 501.01)", () => {
  // Real capture: abbr=AD&code=501&section=01&donem=2026/2027-1. A graduate
  // section with no assigned classroom: the heading renders, then nothing.
  const page = parseQuotaPage(loadFixture("quotasearch-ad501-01.html"), "AD501.01");

  assert.equal(page.cap, null);
  assert.deepEqual(page.rows, []);
  assert.deepEqual(page.surname, []);
  assert.deepEqual(page.warnings, []);
});

test("a blank capacity value parses as null rather than 0", () => {
  const html = loadFixture("quotasearch-cmpe150-01.html").replace(
    "<b>Max. Classroom Capacity:</b> 110",
    "<b>Max. Classroom Capacity:</b> ",
  );
  const page = parseQuotaPage(html, "CMPE150.01");

  assert.equal(page.cap, null);
  assert.deepEqual(page.rows, []);
});

test("a page answering about a different section is reported", () => {
  const page = parseQuotaPage(loadFixture("quotasearch-math101-01.html"), "MATH102.01");

  // The rows still parse — the caller decides what to do — but the mismatch
  // must be visible so one course's enrolment is never filed under another.
  assert.equal(page.rows.length, 1);
  assert.deepEqual(page.warnings, ["MATH102.01: page is about MATH101.01"]);
});

test("internal padding in the site's own code does not trip the check", () => {
  // The site renders "AD  501.01"; our keys are "AD501.01".
  const page = parseQuotaPage(loadFixture("quotasearch-ad501-01.html"), "AD501.01");
  assert.deepEqual(page.warnings, []);
});

test("multiple departmental rows all parse", () => {
  const html = loadFixture("quotasearch-math101-01.html").replace(
    "<tr class='schtd'>",
    "<tr class='schtd'><td><p align=center>CMPE&nbsp;</td><td><p align=center>3&nbsp;</td>" +
      "<td><p align=center>40&nbsp;</td><td><p align=center>12&nbsp;</td></tr>\n<tr class='schtd'>",
  );
  const page = parseQuotaPage(html, "MATH101.01");

  assert.deepEqual(page.rows, [
    { dept: "CMPE", status: "3", quota: 40, current: 12 },
    { dept: "ALL", status: "ALL", quota: 100, current: 134 },
  ]);
  assert.deepEqual(page.warnings, []);
});

test("a class-quota table folds into rows", () => {
  // Synthetic: no sampled page emits this block (see parse-quota.mjs), so the
  // markup below only mirrors the verified departmental table with the caption
  // and first column relabelled. It pins the routing, not BOUN's real HTML.
  const html = loadFixture("quotasearch-math101-01.html").replace(
    "</BODY>",
    `<table BORDER="1">
       <tr class="rectitle"><td colspan=4 class="bodytextdark12">Class Quotas:</td></tr>
       <tr class="title"><td>Class</td><td>Quota</td><td>Current</td></tr>
       <tr class='schtd'><td><p align=center>1&nbsp;</td><td><p align=center>30&nbsp;</td><td><p align=center>31&nbsp;</td></tr>
     </table></BODY>`,
  );
  const page = parseQuotaPage(html, "MATH101.01");

  assert.deepEqual(page.rows, [
    { dept: "ALL", status: "ALL", quota: 100, current: 134 },
    { dept: "1", status: "", quota: 30, current: 31 },
  ]);
  assert.deepEqual(page.warnings, []);
});

test("a surname-restriction table parses both cell shapes", () => {
  // Synthetic for the same reason as above: the field exists to keep the
  // schema stable and is [] on every page we have captured.
  const twoCells = loadFixture("quotasearch-cmpe150-01.html").replace(
    "</BODY>",
    `<table BORDER="1">
       <tr class="rectitle"><td colspan=2>Surname Restrictions:</td></tr>
       <tr class="title"><td>From</td><td>To</td></tr>
       <tr class='schtd'><td>A&nbsp;</td><td>K&nbsp;</td></tr>
     </table></BODY>`,
  );
  assert.deepEqual(parseQuotaPage(twoCells, "X.01").surname, [{ from: "A", to: "K" }]);

  const oneCell = twoCells.replace(
    "<tr class='schtd'><td>A&nbsp;</td><td>K&nbsp;</td></tr>",
    "<tr class='schtd'><td>L - Z&nbsp;</td></tr>",
  );
  assert.deepEqual(parseQuotaPage(oneCell, "X.01").surname, [{ from: "L", to: "Z" }]);
});

test("an unrecognised captioned table is reported, never dropped silently", () => {
  const html = loadFixture("quotasearch-cmpe150-01.html").replace(
    "</BODY>",
    `<table BORDER="1">
       <tr class="rectitle"><td colspan=2>Erasmus Allocations:</td></tr>
       <tr class="title"><td>Programme</td><td>Quota</td><td>Current</td></tr>
       <tr class='schtd'><td>X</td><td>5</td><td>1</td></tr>
     </table></BODY>`,
  );
  const page = parseQuotaPage(html, "CMPE150.01");

  assert.deepEqual(page.rows, []);
  assert.deepEqual(page.warnings, ['CMPE150.01: unrecognised quota table "Erasmus Allocations:"']);
});

test("a quota table missing Quota/Current fails loudly", () => {
  const html = loadFixture("quotasearch-math101-01.html").replace(
    "<td width='10%'><p align=center>Current</td>",
    "<td width='10%'><p align=center>Enrolled</td>",
  );

  assert.throws(() => parseQuotaPage(html, "MATH101.01"), /missing Quota\/Current/);
});

test("a missing section heading fails loudly instead of returning empty", () => {
  // The heading is the format-change detector, because a missing capacity block
  // is a legitimate page (AD501.01) while a missing heading is not.
  const html = loadFixture("quotasearch-cmpe150-01.html").replace(
    "Surname Restriction(s)",
    "Soyad Kisitlamasi",
  );

  assert.throws(() => parseQuotaPage(html, "CMPE150.01"), /section heading absent/);
});

test("a redirect or error page is rejected by title", () => {
  assert.throws(
    () => parseQuotaPage("<html><head><title>Alert</title></head><body>go away</body></html>", "X.01"),
    /not a Quota Information page/,
  );
});

test("a text restriction in the Quota cell is preserved (AD 251.05)", () => {
  // Real capture: abbr=AD&code=251&section=05&donem=2026/2027-1. Its Quota cell
  // reads "Consent Of Instructor" instead of a number, so the section has no
  // numeric allocation and registration is gated by the instructor.
  const page = parseQuotaPage(loadFixture("quotasearch-ad251-05.html"), "AD251.05");

  assert.equal(page.cap, 69);
  assert.deepEqual(page.rows, [
    { dept: "ALL", status: "ALL", quota: 0, current: 0, note: "Consent Of Instructor" },
  ]);
  // The row must not be dropped, and must not raise a warning: this is normal
  // data, not a layout change.
  assert.deepEqual(page.warnings, []);
  // quota stays a number so a consumer can sum rows without special-casing.
  assert.equal(
    page.rows.reduce((sum, r) => sum + r.quota, 0),
    0,
  );
});

test("a plain numeric row carries no note", () => {
  const page = parseQuotaPage(loadFixture("quotasearch-math101-01.html"), "MATH101.01");
  assert.ok(!("note" in page.rows[0]));
});

test("a non-numeric Current is warned about, not coerced", () => {
  const html = loadFixture("quotasearch-math101-01.html").replace(
    "<p align=center>134&nbsp;",
    "<p align=center>n/a&nbsp;",
  );
  const page = parseQuotaPage(html, "MATH101.01");

  assert.deepEqual(page.rows, []);
  assert.equal(page.warnings.length, 1);
  assert.match(page.warnings[0], /non-numeric Current/);
});
