import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REGISTRATION_FIT_KEY,
  departmentOptions,
  emptyProfile,
  readStoredProfile,
  registrationFit,
  writeStoredProfile,
} from "../../../src/lib/registrationFit.mjs";

const filled = { dept: "ECONOMICS", classYear: "2", surname: "Kaya" };

test("empty or whitespace profile renders no badges", () => {
  const blocked = {
    rows: [{ dept: "ECONOMICS" }, { dept: "1", scope: "class" }],
    surname: [{ from: "A", to: "K" }],
  };
  assert.deepEqual(registrationFit(blocked, emptyProfile()).badges, []);
  assert.deepEqual(
    registrationFit(blocked, { dept: "  ", classYear: "\n", surname: "" }).badges,
    [],
  );
  assert.deepEqual(registrationFit(blocked, null).badges, []);
  assert.deepEqual(registrationFit(null, emptyProfile()).notes, []);
});

test("a missing section is no-data, never fit or outside", () => {
  const result = registrationFit(null, filled);
  assert.deepEqual(result.badges, ["no-data"]);
  assert.equal(result.badges.includes("fit"), false);
  assert.equal(result.badges.includes("dept"), false);
  assert.equal(result.badges.includes("class"), false);
  assert.equal(result.badges.includes("surname"), false);
  assert.deepEqual(registrationFit(undefined, filled).badges, ["no-data"]);
});

test("a record with no restrictions is a fit", () => {
  assert.deepEqual(registrationFit({ cap: 10 }, filled).badges, ["fit"]);
});

test("only ALL is not a department barrier", () => {
  const section = { rows: [{ dept: "ALL", status: "ALL", quota: 50, current: 1 }] };
  assert.deepEqual(registrationFit(section, filled).badges, ["fit"]);
});

test("department match is trim and Turkish case-insensitive", () => {
  const section = { rows: [{ dept: "ECONOMICS", status: "UNDERGRADUATE" }] };
  const result = registrationFit(section, { ...filled, dept: "economics " });
  assert.equal(result.badges.includes("dept"), false);
  assert.deepEqual(result.badges, ["fit"]);
});

test("a different department is outside, not a fit", () => {
  const section = { rows: [{ dept: "ECONOMICS" }] };
  const result = registrationFit(section, { ...filled, dept: "COMPUTER ENGINEERING" });
  assert.equal(result.badges.includes("dept"), true);
  assert.equal(result.badges.includes("fit"), false);
});

test("ALL beside a named department does not waive the name", () => {
  const section = {
    rows: [
      { dept: "ALL", status: "ALL", quota: 10, current: 1 },
      { dept: "ECONOMICS", status: "UNDERGRADUATE" },
    ],
  };
  const result = registrationFit(section, { ...filled, dept: "MANAGEMENT" });
  assert.deepEqual(result.badges, ["dept"]);
});

test("no class row means class year is not a barrier", () => {
  const result = registrationFit({ cap: 10 }, { ...filled, classYear: "9" });
  assert.equal(result.badges.includes("class"), false);
  assert.deepEqual(result.badges, ["fit"]);
});

test("class year 01 matches scope:class 1", () => {
  const section = { rows: [{ dept: "1", scope: "class", quota: 30, current: 1 }] };
  assert.deepEqual(
    registrationFit(section, { ...filled, classYear: "01" }).badges,
    ["fit"],
  );
});

test("a different class year is outside", () => {
  const section = { rows: [{ dept: "2", scope: "class" }] };
  const result = registrationFit(section, { ...filled, classYear: "1" });
  assert.deepEqual(result.badges, ["class"]);
});

test("a semester row is not a class barrier", () => {
  const section = { rows: [{ dept: "5", scope: "semester" }] };
  const result = registrationFit(section, { ...filled, classYear: "1" });
  assert.equal(result.badges.includes("class"), false);
  assert.deepEqual(result.badges, ["fit"]);
});

test("no surname band is not a surname barrier", () => {
  const result = registrationFit({ cap: 10 }, { ...filled, surname: "Zeybek" });
  assert.equal(result.badges.includes("surname"), false);
  assert.deepEqual(result.badges, ["fit"]);
});

test("surname band A-K is inclusive", () => {
  const section = { surname: [{ from: "A", to: "K" }] };
  assert.deepEqual(registrationFit(section, { ...filled, surname: "Kaya" }).badges, ["fit"]);
  assert.deepEqual(registrationFit(section, { ...filled, surname: "Ali" }).badges, ["fit"]);
  const outside = registrationFit(section, { ...filled, surname: "Yılmaz" });
  assert.deepEqual(outside.badges, ["surname"]);
});

test("Turkish uppercase distinguishes i and ı", () => {
  const high = { surname: [{ from: "İ", to: "K" }] };
  const low = { surname: [{ from: "A", to: "I" }] };
  assert.deepEqual(registrationFit(high, { ...filled, surname: "istanbul" }).badges, ["fit"]);
  assert.equal(
    registrationFit(low, { ...filled, surname: "istanbul" }).badges.includes("surname"),
    true,
  );
  assert.deepEqual(registrationFit(low, { ...filled, surname: "ışık" }).badges, ["fit"]);
  assert.equal(
    registrationFit(high, { ...filled, surname: "ışık" }).badges.includes("surname"),
    true,
  );
});

test("Ç sits between C and D", () => {
  assert.deepEqual(
    registrationFit({ surname: [{ from: "C", to: "D" }] }, { ...filled, surname: "Çelik" }).badges,
    ["fit"],
  );
  assert.equal(
    registrationFit({ surname: [{ from: "A", to: "C" }] }, { ...filled, surname: "Çelik" }).badges.includes(
      "surname",
    ),
    true,
  );
});

test("a broken surname band is no-data, not fit and not outside", () => {
  for (const band of [
    { from: "K", to: "A" },
    { from: "", to: "K" },
    { from: "AA", to: "K" },
    { from: "Q", to: "Z" },
  ]) {
    const result = registrationFit({ surname: [band] }, filled);
    assert.equal(result.badges.includes("no-data"), true, JSON.stringify(band));
    assert.equal(result.badges.includes("fit"), false, JSON.stringify(band));
    assert.equal(result.badges.includes("surname"), false, JSON.stringify(band));
  }
});

test("a broken band does not hide a known department mismatch", () => {
  const section = {
    rows: [{ dept: "ECONOMICS" }],
    surname: [{ from: "K", to: "A" }],
  };
  const result = registrationFit(section, { ...filled, dept: "MANAGEMENT" });
  assert.equal(result.badges.includes("dept"), true);
  assert.equal(result.badges.includes("no-data"), true);
  assert.equal(result.badges.includes("fit"), false);
  assert.equal(result.badges.includes("surname"), false);
});

test("a valid band is not trusted when another band is broken", () => {
  const section = { surname: [{ from: "A", to: "C" }, { from: "K", to: "A" }] };
  const result = registrationFit(section, { ...filled, surname: "Ali" });
  assert.deepEqual(result.badges, ["no-data"]);
});

test("Consent Of Instructor is text, not a barrier", () => {
  const section = {
    note: "Consent Of Instructor",
    rows: [
      { dept: "ALL", status: "ALL", note: "Unlimited" },
      { dept: "ALL", note: "Consent Of Instructor" },
    ],
  };
  const result = registrationFit(section, filled);
  assert.deepEqual(result.badges, ["fit"]);
  assert.deepEqual(result.notes, ["Consent Of Instructor"]);
  assert.equal(result.notes.includes("Unlimited"), false);
});

test("three known failures are all reported, in a stable order", () => {
  const section = {
    rows: [
      { dept: "ECONOMICS" },
      { dept: "2", scope: "class" },
    ],
    surname: [{ from: "A", to: "K" }],
  };
  const result = registrationFit(section, {
    dept: "MANAGEMENT",
    classYear: "1",
    surname: "Yılmaz",
  });
  assert.deepEqual(result.badges, ["surname", "dept", "class"]);
});

test("department options come only from real departmental names", () => {
  const sections = {
    a: {
      rows: [
        { dept: "ALL" },
        { dept: "1", scope: "class" },
        { dept: "6", scope: "semester" },
        { dept: "ECONOMICS" },
        { dept: "economics" },
      ],
    },
    b: { rows: [{ dept: "MANAGEMENT" }] },
  };
  const options = departmentOptions(sections);
  assert.deepEqual(options, ["ECONOMICS", "MANAGEMENT"]);
  assert.equal(options.includes("ALL"), false);
  assert.equal(options.includes("1"), false);
  assert.equal(options.includes("6"), false);
  assert.equal(options.includes("COMPUTER ENGINEERING"), false);
  assert.deepEqual(departmentOptions(null), []);
});

test("storage read and write survive a throwing store", () => {
  const throwing = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(readStoredProfile(throwing), emptyProfile());
  assert.equal(writeStoredProfile(throwing, filled), false);
});

test("storage round-trip keeps only the three profile fields", () => {
  /** @type {Record<string, string>} */
  const data = {};
  const storage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
  };
  assert.equal(writeStoredProfile(storage, { ...filled, extra: "no" }), true);
  assert.equal(Object.keys(JSON.parse(data[REGISTRATION_FIT_KEY])).sort().join(","), "classYear,dept,surname");
  assert.deepEqual(readStoredProfile(storage), filled);
  data[REGISTRATION_FIT_KEY] = "{not json";
  assert.deepEqual(readStoredProfile(storage), emptyProfile());
});
