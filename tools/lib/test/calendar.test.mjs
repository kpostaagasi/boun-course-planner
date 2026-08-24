import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  parseDateLine,
  toSemesterKey,
  parseCalendarText,
} from "../parse-calendar.mjs";

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "akademik-takvim-2026-2027.pdf",
);

test("parseDateLine reads single dates with weekday", () => {
  assert.deepEqual(parseDateLine("21 Eylül 2026 Pazartesi"), {
    y: 2026, m: 9, d1: 21, d2: 21,
  });
});

test("parseDateLine reads date ranges with weekday range", () => {
  assert.deepEqual(parseDateLine("8-12 Mart 2027 Pazartesi-Cuma"), {
    y: 2027, m: 3, d1: 8, d2: 12,
  });
});

test("parseDateLine returns null for non-date lines and unknown months", () => {
  assert.equal(parseDateLine("Derslerin başlaması"), null);
  assert.equal(parseDateLine("31 Foo 2026 Pazartesi"), null);
});

test("toSemesterKey maps months onto BOUN academic-year terms", () => {
  assert.equal(toSemesterKey({ y: 2026, m: 9 }), "2026-2027-1");
  assert.equal(toSemesterKey({ y: 2026, m: 12 }), "2026-2027-1");
  // January belongs to the spring term of the running academic year.
  assert.equal(toSemesterKey({ y: 2027, m: 1 }), "2026-2027-2");
  assert.equal(toSemesterKey({ y: 2027, m: 4 }), "2026-2027-2");
  assert.equal(toSemesterKey({ y: 2027, m: 7 }), "2026-2027-3");
});

test("parseCalendarText reproduces the hand-entered fall 2026 semester exactly", async () => {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const bytes = readFileSync(FIXTURE);
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });

  const result = parseCalendarText(text);
  const reference = JSON.parse(
    readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "..",
        "public",
        "data",
        "semester-dates.json",
      ),
      "utf8",
    ),
  )["2026-2027-1"];

  const got = result["2026-2027-1"];
  assert.ok(got, "fall semester must be found in the PDF");
  assert.equal(got.start, reference.start);
  assert.equal(got.end, reference.end);

  for (const want of reference.holidays) {
    const match = got.holidays.find((h) => h.date === want.date);
    assert.ok(match, `holiday on ${want.date} must be extracted`);
    assert.equal(match.name, want.name);
    assert.equal(match.timeType ?? undefined, want.timeType);
    assert.equal(match.time ?? undefined, want.time);
  }
});

test("parseCalendarText extracts spring boundaries and multi-day holidays", async () => {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const bytes = readFileSync(FIXTURE);
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });

  const spring = parseCalendarText(text)["2026-2027-2"];
  assert.equal(spring.start, "2027-01-18"); // Derslerin başlaması (YADYOK dahil)
  assert.equal(spring.end, "2027-04-22");

  // Bahar Tatili spans 8–12 Mart; each day becomes its own holiday entry.
  const bahar = spring.holidays.filter((h) => /Bahar Tatili/.test(h.name));
  assert.deepEqual(
    bahar.map((h) => h.date),
    ["2027-03-08", "2027-03-09", "2027-03-10", "2027-03-11", "2027-03-12"],
  );

  // Arife is a named half-day.
  const arife = spring.holidays.find((h) => /Arife/.test(h.name));
  assert.deepEqual(arife, {
    date: "2027-05-15",
    name: "Arife (Yarım Gün)",
    timeType: "after",
    time: "13:00",
  });
});

test("parseCalendarText ignores YADYOK-only and summer course boundaries", async () => {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const bytes = readFileSync(FIXTURE);
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });

  const result = parseCalendarText(text);
  // Summer term has holidays but no scraped start/end (Yaz Öğretimi lines are excluded).
  const summer = result["2026-2027-3"];
  if (summer) {
    assert.equal(summer.start, null);
    assert.equal(summer.end, null);
  }
  // Fall start must be the site-wide one (21 Eyl), not YADYOK's (23 Eyl).
  assert.equal(result["2026-2027-1"].start, "2026-09-21");
});
