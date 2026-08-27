import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInstructorIndex,
  findInstructors,
  instructorsForCourse,
  matchInstructorQuery,
  normalizeInstructorName,
} from "../../../src/lib/instructors.mjs";

// Fixtures mirror the real hazards of public/data/<term>.json: three scraped
// spellings of one person, a STAFF placeholder, a Turkish dotted/dotless pair,
// keys that deviate from <DEPT><NUM>.<SEC>, and a section with no schedule.
const CURRENT = {
  "CMPE150.01": {
    instructor: "MÜGE TAŞKIN AYDIN",
    name: "INTRODUCTION TO COMPUTING",
    days: ["M", "W"],
    hours: [3, 4],
    rooms: ["M 1171", "M 1171"],
  },
  "CMPE150.02": {
    instructor: "MÜGE TAŞKIN AYDIN",
    name: "INTRODUCTION TO COMPUTING",
    days: ["T"],
    hours: [5],
    rooms: ["TB 130"],
  },
  "CMPE150.01 P.S. 1": {
    instructor: "MÜGE TAŞKIN-AYDIN",
    name: "INTRODUCTION TO COMPUTING",
  },
  "IE310.01": {
    instructor: "müge  taşkın aydın",
    name: "STOCHASTIC MODELS",
    days: ["F"],
    hours: [8],
    rooms: ["M 2170"],
  },
  "AD 211.01": {
    instructor: "FATİH F.YILMAZ",
    name: "FINANCIAL ACCOUNTING FOR ECONOMISTS",
    days: ["M", "M", "M"],
    hours: [3, 4, 5],
    rooms: ["M 1171"],
  },
  "AD48L.01": {
    instructor: "FATİH F.YILMAZ",
    name: "ACCOUNTING LAB",
  },
  "MATH101.01": {
    instructor: "FATIMAT ZHILETEZHEVA",
    name: "CALCULUS I",
    days: ["Th"],
    hours: [2],
    rooms: ["TB 250"],
  },
  "MATH101.02": {
    instructor: "FATİH F.YILMAZ",
    name: "CALCULUS I",
    days: ["F"],
    hours: [1],
    rooms: ["TB 250"],
  },
  "CMPE250.01": { instructor: "STAFF STAFF", name: "DATA STRUCTURES" },
  "CMPE250.02": { instructor: "BELİRTİLMEDİ", name: "DATA STRUCTURES" },
};

const OLDER = {
  "CMPE150.01": {
    instructor: "MÜGE TAŞKIN-AYDIN",
    name: "INTRODUCTION TO COMPUTING",
    days: ["M"],
    hours: [3],
  },
  "CMPE150.02": {
    instructor: "MÜGE TAŞKIN-AYDIN",
    name: "INTRODUCTION TO COMPUTING",
  },
  "CMPE150.03": {
    instructor: "MÜGE TAŞKIN-AYDIN",
    name: "INTRODUCTION TO COMPUTING",
  },
  "MATH101.01": { instructor: "FATİMAT ZHILETEZHEVA", name: "CALCULUS I" },
  "HIST105.01": { instructor: "NURAY AKÇA", name: "HISTORY OF TURKEY" },
  "CMPE250.01": { instructor: "STAFF STAFF", name: "DATA STRUCTURES" },
};

const single = () =>
  buildInstructorIndex([{ term: "2026-2027-1", data: CURRENT }]);
const archive = () =>
  buildInstructorIndex([
    { term: "2026-2027-1", data: CURRENT },
    { term: "2025-2026-2", data: OLDER },
  ]);

const MUGE = "MUGE TASKIN AYDIN";
const FATIH = "FATIH F YILMAZ";

test("index groups a term's sections per instructor in catalogue order", () => {
  const index = single();
  assert.deepEqual(index.terms, ["2026-2027-1"]);
  const muge = index.byKey[MUGE];
  assert.deepEqual(
    muge.sections.map((s) => s.sectionKey),
    ["CMPE150.01", "CMPE150.02", "CMPE150.01 P.S. 1", "IE310.01"],
  );
  assert.deepEqual(muge.sections[0].days, ["M", "W"]);
  assert.deepEqual(muge.sections[0].hours, [3, 4]);
  assert.deepEqual(muge.terms, ["2026-2027-1"]);
  // Deviating keys still collapse to a base code.
  assert.deepEqual(
    index.byKey[FATIH].sections.map((s) => s.code),
    ["AD211", "AD48L", "MATH101"],
  );
});

test("placeholder instructor cells are excluded from the index and counted", () => {
  const index = single();
  assert.equal(index.placeholderSections, 2);
  assert.equal(index.byKey.STAFF, undefined);
  assert.equal(index.byKey["STAFF STAFF"], undefined);
  assert.equal(index.byKey.BELIRTILMEDI, undefined);
  assert.ok(!index.keys.some((key) => /STAFF|BELIRTILMEDI/.test(key)));
  // No placeholder can be reached through any lookup path either.
  assert.equal(matchInstructorQuery(index, "STAFF STAFF"), null);
  assert.equal(matchInstructorQuery(index, "BELİRTİLMEDİ"), null);
  assert.deepEqual(findInstructors(index, "STAFF"), []);
  assert.deepEqual(instructorsForCourse(index, "CMPE250"), []);
  assert.equal(archive().placeholderSections, 3);
});

test("every scraped spelling of one person collapses to a single key", () => {
  for (const raw of [
    "MÜGE TAŞKIN AYDIN",
    "MÜGE TAŞKIN-AYDIN",
    "müge  taşkın aydın",
    "MÜGE TAŞKIN (AYDIN)",
    "  müge taşkın aydın  ",
  ]) {
    assert.equal(normalizeInstructorName(raw), MUGE, raw);
  }
  const index = single();
  assert.equal(index.keys.filter((key) => key.includes("TASKIN")).length, 1);
  assert.equal(index.byKey[MUGE].sections.length, 4);
  // Initials keep their own token, so "F.YILMAZ" is not merged into "YILMAZ".
  assert.equal(normalizeInstructorName("FATİH F.YILMAZ"), FATIH);
  assert.notEqual(normalizeInstructorName("FATİH YILMAZ"), FATIH);
});

test("display keeps a real scraped spelling, preferring the current term's", () => {
  const index = archive();
  const muge = index.byKey[MUGE];
  // The older term spells it with a hyphen three times, the current term
  // spells it with a space twice: the current term wins.
  assert.equal(muge.display, "MÜGE TAŞKIN AYDIN");
  assert.deepEqual(muge.variants, [
    "MÜGE TAŞKIN AYDIN",
    "MÜGE TAŞKIN-AYDIN",
    "müge  taşkın aydın",
  ]);
  const everyRawCell = new Set(
    [...Object.values(CURRENT), ...Object.values(OLDER)].map(
      (section) => section.instructor,
    ),
  );
  for (const key of index.keys) {
    assert.ok(
      everyRawCell.has(index.byKey[key].display),
      `${index.byKey[key].display} is not a scraped spelling`,
    );
  }
  // Someone who taught only in an archived term has no sections this term.
  assert.deepEqual(index.byKey["NURAY AKCA"].sections, []);
  assert.deepEqual(index.byKey["NURAY AKCA"].terms, ["2025-2026-2"]);
});

test("normalisation survives Turkish dotted/dotless casing", () => {
  // The trap: neither of these round-trips, so no lower-casing step is used.
  assert.notEqual("İ".toLowerCase(), "i");
  assert.notEqual("I".toLowerCase().toUpperCase(), "İ");
  for (const ch of ["İ", "I", "ı", "i", "Î", "î"]) {
    assert.equal(normalizeInstructorName(ch), "I", ch);
  }
  assert.equal(
    normalizeInstructorName("FATİMAT ZHILETEZHEVA"),
    normalizeInstructorName("FATIMAT ZHILETEZHEVA"),
  );
  for (const raw of ["ÖJENİ MAZALTO", "NURAY AKÇA", "TÜLAY GENÇTÜRK-DEMİRCİOĞLU"]) {
    const once = normalizeInstructorName(raw);
    assert.equal(normalizeInstructorName(once), once, "not idempotent");
    assert.match(once, /^[A-Z0-9 ]+$/);
  }
  // The dotted and dotless spellings of one person are one entry, over terms.
  const fatimat = archive().byKey["FATIMAT ZHILETEZHEVA"];
  assert.deepEqual(fatimat.variants, [
    "FATIMAT ZHILETEZHEVA",
    "FATİMAT ZHILETEZHEVA",
  ]);
  assert.deepEqual(fatimat.terms, ["2026-2027-1", "2025-2026-2"]);
});

test("lecture, problem session and lab of one course stay one course", () => {
  const muge = single().byKey[MUGE];
  const cmpe150 = muge.courses.find((c) => c.code === "CMPE150");
  assert.deepEqual(cmpe150.sectionKeys, [
    "CMPE150.01",
    "CMPE150.02",
    "CMPE150.01 P.S. 1",
  ]);
  assert.equal(cmpe150.name, "INTRODUCTION TO COMPUTING");
  assert.deepEqual(
    muge.courses.map((c) => c.code),
    ["CMPE150", "IE310"],
  );
});

test("a course with several instructors lists all of them", () => {
  const index = single();
  assert.deepEqual(index.courseToKeys.MATH101.slice().sort(), [
    FATIH,
    "FATIMAT ZHILETEZHEVA",
  ]);
  const credits = instructorsForCourse(index, "MATH101");
  // UTF-16 order, not Turkish collation: "FATI…" sorts before "FATİ…".
  assert.deepEqual(
    credits.map((c) => c.display).sort(),
    ["FATIMAT ZHILETEZHEVA", "FATİH F.YILMAZ"],
  );
  assert.deepEqual(
    credits.find((c) => c.key === FATIH).sectionKeys,
    ["MATH101.02"],
  );
});

test("reverse lookup ranks the most persistent teacher first", () => {
  const index = archive();
  // FATIMAT taught MATH101 in both terms, FATİH only in the current one.
  assert.deepEqual(
    instructorsForCourse(index, "MATH101").map((c) => [c.display, c.terms.length]),
    [
      ["FATIMAT ZHILETEZHEVA", 2],
      ["FATİH F.YILMAZ", 1],
    ],
  );
  // A full section key resolves to the same course as its base code.
  assert.deepEqual(
    instructorsForCourse(index, "MATH101.02").map((c) => c.key),
    instructorsForCourse(index, "MATH101").map((c) => c.key),
  );
  assert.deepEqual(instructorsForCourse(index, "PHYS101"), []);
});

test("history spans exactly the terms handed in", () => {
  const index = archive();
  assert.deepEqual(index.terms, ["2026-2027-1", "2025-2026-2"]);
  const cmpe150 = index.byKey[MUGE].courses.find((c) => c.code === "CMPE150");
  assert.deepEqual(cmpe150.terms, ["2026-2027-1", "2025-2026-2"]);
  // sectionKeys stay primary-term only: an archived section is not addressable
  // in the current catalogue.
  assert.deepEqual(cmpe150.sectionKeys, [
    "CMPE150.01",
    "CMPE150.02",
    "CMPE150.01 P.S. 1",
  ]);
  const ie310 = index.byKey[MUGE].courses.find((c) => c.code === "IE310");
  assert.deepEqual(ie310.terms, ["2026-2027-1"]);
  // A one-term index cannot claim more than one term of history.
  assert.deepEqual(single().byKey[MUGE].courses[0].terms, ["2026-2027-1"]);
});

test("an exact name query resolves whatever spelling it arrives in", () => {
  const index = single();
  for (const raw of [
    "MÜGE TAŞKIN AYDIN",
    "müge taşkın-aydın",
    "MUGE TASKIN AYDIN",
    "  MÜGE   TAŞKIN  AYDIN ",
  ]) {
    assert.equal(matchInstructorQuery(index, raw)?.key, MUGE, raw);
  }
  assert.equal(matchInstructorQuery(index, "MÜGE"), null);
  assert.equal(matchInstructorQuery(index, "TAŞKIN AYDIN"), null);
  assert.equal(matchInstructorQuery(index, ""), null);
  assert.equal(matchInstructorQuery(index, null), null);
  assert.equal(matchInstructorQuery(index, "CMPE150"), null);
});

test("suggestions match on any token, ranked and capped", () => {
  const index = single();
  assert.deepEqual(
    findInstructors(index, "taşkın").map((e) => e.display),
    ["MÜGE TAŞKIN AYDIN"],
  );
  // Same rank, so the person with more sections this term comes first:
  // FATİH teaches three, FATIMAT one.
  assert.deepEqual(
    findInstructors(index, "fat").map((e) => e.display),
    ["FATİH F.YILMAZ", "FATIMAT ZHILETEZHEVA"],
  );
  // Exact key outranks a longer key that merely contains the query.
  assert.equal(findInstructors(index, "FATİH F.YILMAZ")[0].key, FATIH);
  assert.equal(findInstructors(index, "fat", 1).length, 1);
  assert.deepEqual(findInstructors(index, "f"), []);
  assert.deepEqual(findInstructors(index, ""), []);
  assert.deepEqual(findInstructors(index, "ZZZ"), []);
});

test("sections without a schedule keep empty arrays instead of crashing", () => {
  const index = buildInstructorIndex([
    {
      term: "2026-2027-1",
      data: {
        "CMPE150.01 P.S. 1": { instructor: "MÜGE TAŞKIN AYDIN" },
        "XX100.01": { instructor: "AYŞE KAYA", days: null, hours: "nope" },
      },
    },
  ]);
  const ps = index.byKey[MUGE].sections[0];
  assert.deepEqual(ps.days, []);
  assert.deepEqual(ps.hours, []);
  assert.deepEqual(ps.rooms, []);
  assert.equal(ps.name, "");
  const junk = index.byKey["AYSE KAYA"].sections[0];
  assert.deepEqual([junk.days, junk.hours, junk.rooms], [[], [], []]);
});

test("degenerate inputs produce an empty index, not an exception", () => {
  for (const arg of [[], null, undefined, [null], [{ term: "x" }], [{ data: {} }]]) {
    const index = buildInstructorIndex(/** @type {any} */ (arg));
    assert.deepEqual(index.keys, []);
    assert.deepEqual(index.byKey, {});
    assert.equal(index.placeholderSections, 0);
    assert.equal(matchInstructorQuery(index, "MÜGE TAŞKIN AYDIN"), null);
    assert.deepEqual(findInstructors(index, "müge"), []);
    assert.deepEqual(instructorsForCourse(index, "CMPE150"), []);
  }
});
