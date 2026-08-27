import test from "node:test";
import assert from "node:assert/strict";
import { quotaAge, quotaDisplay } from "../../../src/lib/quotaInfo.mjs";

test("no record at all is unknown, and every number stays null", () => {
  for (const input of [null, undefined, {}]) {
    const d = quotaDisplay(input);
    assert.equal(d.kind, "unknown");
    assert.equal(d.cap, null);
    assert.equal(d.quota, null);
    assert.equal(d.current, null);
    // The whole point: never 0. "0 seats left" is a different claim.
    assert.equal(d.free, null);
    assert.equal(d.full, false);
    assert.equal(d.overEnrolled, false);
  }
});

test("capacity-only: the room size is all the page stated", () => {
  // The shipped file's majority case — `rows` and `surname` are omitted.
  const d = quotaDisplay({ cap: 109 });
  assert.equal(d.kind, "capacity-only");
  assert.equal(d.cap, 109);
  assert.equal(d.quota, null);
  assert.equal(d.current, null);
  assert.equal(d.free, null);
  assert.equal(d.full, false);
  assert.equal(d.restricted, false);
});

test("a single ALL/ALL row yields seats used, seats left and no restriction", () => {
  const d = quotaDisplay({
    cap: 195,
    rows: [{ dept: "ALL", status: "ALL", quota: 100, current: 62 }],
  });
  assert.equal(d.kind, "enrolment");
  assert.equal(d.quota, 100);
  assert.equal(d.current, 62);
  assert.equal(d.free, 38);
  assert.equal(d.full, false);
  assert.equal(d.overEnrolled, false);
  assert.deepEqual(d.depts, []);
  assert.equal(d.restricted, false);
  assert.equal(d.cap, 195);
});

test("multiple rows are summed, not read at index 0", () => {
  const d = quotaDisplay({
    rows: [
      { dept: "CMPE", status: "ALL", quota: 40, current: 38 },
      { dept: "EE", status: "ALL", quota: 30, current: 12 },
      { dept: "MATH", status: "JUNIOR", quota: 10, current: 4 },
    ],
  });
  assert.equal(d.quota, 80);
  assert.equal(d.current, 54);
  assert.equal(d.free, 26);
  // Departmental restriction: the rows name specific departments, not ALL.
  assert.deepEqual(d.depts, ["CMPE", "EE", "MATH"]);
  assert.equal(d.restricted, true);
  assert.deepEqual(d.statuses, ["JUNIOR"]);
});

test("exactly-full is full but not over-enrolled", () => {
  const d = quotaDisplay({ rows: [{ dept: "ALL", quota: 50, current: 50 }] });
  assert.equal(d.free, 0);
  assert.equal(d.full, true);
  assert.equal(d.overEnrolled, false);
});

test("over-enrolment is reported, and free never goes negative", () => {
  // Real shape: the registrar admits past the allocation (ALL/ALL 100 vs 134).
  const d = quotaDisplay({ cap: 195, rows: [{ dept: "ALL", quota: 100, current: 134 }] });
  assert.equal(d.kind, "enrolment");
  assert.equal(d.quota, 100);
  assert.equal(d.current, 134);
  assert.equal(d.free, 0);
  assert.equal(d.full, true);
  assert.equal(d.overEnrolled, true);
});

test("a consent-only row never becomes a fabricated 0-of-0 FULL", () => {
  // AD251.05 of 2026/2027-1: the Quota cell reads "Consent Of Instructor", so
  // the producer stores quota: 0 plus the verbatim note.
  const d = quotaDisplay({
    cap: 65,
    rows: [{ dept: "ALL", status: "ALL", quota: 0, current: 0, note: "Consent Of Instructor" }],
  });
  assert.equal(d.kind, "note-only");
  assert.equal(d.quota, null);
  assert.equal(d.free, null);
  assert.equal(d.full, false);
  assert.equal(d.overEnrolled, false);
  // The enrolment count is still real, and so is the rule.
  assert.equal(d.current, 0);
  assert.deepEqual(d.notes, ["Consent Of Instructor"]);
  assert.equal(d.cap, 65);
});

test("a note row alongside a numeric row does not inflate the allocation", () => {
  const d = quotaDisplay({
    rows: [
      { dept: "CMPE", quota: 40, current: 30 },
      { dept: "ALL", quota: 0, current: 5, note: "Consent Of Instructor" },
    ],
  });
  assert.equal(d.kind, "enrolment");
  assert.equal(d.quota, 40);
  assert.equal(d.current, 35);
  assert.equal(d.free, 5);
  assert.deepEqual(d.notes, ["Consent Of Instructor"]);
});

test("surname restriction is surfaced whenever the file records one", () => {
  const d = quotaDisplay({ rows: [{ dept: "ALL", quota: 60, current: 10 }], surname: [{ from: "A", to: "K" }] });
  assert.equal(d.surnameRestricted, true);
  assert.equal(d.surnameCount, 1);

  const none = quotaDisplay({ rows: [{ dept: "ALL", quota: 60, current: 10 }] });
  assert.equal(none.surnameRestricted, false);
  assert.equal(none.surnameCount, 0);
});

test("garbage in the record degrades to unknown instead of to zero", () => {
  const d = quotaDisplay(
    /** @type {any} */ ({ cap: "many", rows: "nope", surname: 3 }),
  );
  assert.equal(d.kind, "unknown");
  assert.equal(d.cap, null);
  assert.equal(d.quota, null);
  assert.equal(d.current, null);
  assert.equal(d.surnameRestricted, false);
});

test("quotaAge reports the coarsest unit that is still at least one", () => {
  const base = Date.parse("2026-08-27T12:00:00.000Z");
  assert.deepEqual(quotaAge("2026-08-27T11:58:00.000Z", base), {
    unit: "minute",
    value: 2,
    minutes: 2,
  });
  assert.deepEqual(quotaAge("2026-08-27T09:00:00.000Z", base), {
    unit: "hour",
    value: 3,
    minutes: 180,
  });
  assert.equal(quotaAge("2026-08-25T12:00:00.000Z", base)?.unit, "day");
  assert.equal(quotaAge("2026-08-25T12:00:00.000Z", base)?.value, 2);
});

test("an undatable scrape is null, so the card cannot imply the numbers are live", () => {
  const base = Date.parse("2026-08-27T12:00:00.000Z");
  assert.equal(quotaAge(undefined, base), null);
  assert.equal(quotaAge("", base), null);
  assert.equal(quotaAge("last Tuesday", base), null);
  // Clock skew must not read as a negative age.
  assert.deepEqual(quotaAge("2026-08-27T12:05:00.000Z", base), {
    unit: "minute",
    value: 0,
    minutes: 0,
  });
});
