import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaletteEntries,
  searchPalette,
  groupPaletteResults,
  describeSchedule,
  summarizeQuota,
  uniqueRooms,
  slotToClock,
  UNSCHEDULED_LABEL,
} from "../../../src/lib/paletteSearch.mjs";

const semesterData = {
  "CMPE210.01": { code: "CMPE  210.01", name: "DATA STRUCTURES", instructor: "TANER ESKIN" },
  "CMPE150.02": { code: "CMPE  150.02", name: "INTRODUCTION TO COMPUTING", instructor: "AYŞE KARATAŞ" },
  "MATH101.01": { code: "MATH 101.01", name: "CALCULUS I", instructor: "METİN ERCAN" },
  "EE210.01": { code: "EE 210.01", name: "SIGNALS AND SYSTEMS", instructor: "CMPE GUEST" },
};

// Shaped exactly like public/data/<term>.json: index-aligned days/hours/rooms,
// numeric credits, sibling sections that differ only by meeting time, a lab
// sub-section, and a section with no schedule keys at all.
const richData = {
  "MATH101.01": {
    code: "MATH101.01",
    name: "CALCULUS I",
    instructor: "MÜGE TAŞKIN AYDIN",
    credits: 4,
    ects: 6,
    days: ["T", "T", "Th", "Th"],
    hours: [1, 2, 1, 2],
    rooms: ["HD 101", "HD 101", "NH 101", "NH 101"],
  },
  "MATH101.02": {
    code: "MATH101.02",
    name: "CALCULUS I",
    instructor: "MÜGE TAŞKIN AYDIN",
    credits: 4,
    ects: 6,
    days: ["T", "T", "Th", "Th"],
    hours: [3, 4, 3, 4],
    rooms: ["HD 101", "HD 101", "NH 101", "NH 101"],
  },
  "MATH101.03": {
    code: "MATH101.03",
    name: "CALCULUS I",
    instructor: "FATIH ECEVIT",
    credits: 4,
    ects: 6,
    days: ["M", "W"],
    hours: [5, 5],
    rooms: ["TB 101", "TB 101"],
  },
  "AD251.01 P.S. 1": {
    code: "AD  251.01",
    name: "MANAGERIAL STATISTICS I P.S.",
    instructor: "ZEHRA BİLGEN SUSANLI",
  },
  "CMPE150.01": {
    code: "CMPE150.01",
    name: "INTRODUCTION TO COMPUTING",
    instructor: "EMRE UĞUR",
    credits: 3,
    days: ["T"],
    hours: [8],
    rooms: ["EF 06"],
  },
  "CMPE150.01 LAB 1": {
    code: "CMPE150.01",
    name: "INTRODUCTION TO COMPUTING LAB",
    instructor: "EMRE UĞUR",
    days: ["F"],
    hours: [10],
    rooms: ["ETA 31"],
  },
};

/** @returns {Record<string, any>} entries keyed by section key */
function keyed(entries) {
  const out = {};
  for (const entry of entries) out[entry.courseName] = entry;
  return out;
}

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

test("entries carry the section key, days, hours, rooms and credits", () => {
  const byKey = keyed(buildPaletteEntries(richData));
  const lecture = byKey["MATH101.01"];
  assert.equal(lecture.courseName, "MATH101.01");
  assert.equal(lecture.code, "MATH101");
  assert.equal(lecture.section, "01");
  assert.deepEqual(lecture.days, ["T", "T", "Th", "Th"]);
  assert.deepEqual(lecture.hours, [1, 2, 1, 2]);
  assert.deepEqual(lecture.rooms, ["HD 101", "HD 101", "NH 101", "NH 101"]);
  assert.equal(lecture.credits, 4);
  assert.equal(lecture.scheduled, true);

  // Sub-sections keep everything after the first dot.
  const lab = byKey["CMPE150.01 LAB 1"];
  assert.equal(lab.code, "CMPE150");
  assert.equal(lab.section, "01 LAB 1");
  assert.deepEqual(lab.days, ["F"]);
  assert.deepEqual(lab.hours, [10]);
});

test("unscheduled sections get a defined label, not an empty string", () => {
  const byKey = keyed(buildPaletteEntries(richData));
  const ps = byKey["AD251.01 P.S. 1"];
  assert.deepEqual(ps.days, []);
  assert.deepEqual(ps.hours, []);
  assert.equal(ps.scheduled, false);

  const label = describeSchedule(ps);
  assert.equal(label, UNSCHEDULED_LABEL);
  assert.ok(label.length > 0);
  // Callers can localize it.
  assert.equal(
    describeSchedule(ps, { unscheduled: "Saati belirsiz" }),
    "Saati belirsiz",
  );

  // Days present but no usable slot numbers is unscheduled too, not a crash.
  const dayOnly = buildPaletteEntries({ "X100.01": { days: ["M"] } })[0];
  assert.equal(dayOnly.scheduled, false);
  assert.equal(describeSchedule(dayOnly), UNSCHEDULED_LABEL);
});

test("describeSchedule collapses runs and orders days by weekday", () => {
  const byKey = keyed(buildPaletteEntries(richData));
  assert.equal(
    describeSchedule(byKey["MATH101.01"]),
    "Tue 09:00-11:00 · Thu 09:00-11:00",
  );
  assert.equal(describeSchedule(byKey["MATH101.03"]), "Mon 13:00 · Wed 13:00");
  assert.equal(describeSchedule(byKey["CMPE150.01 LAB 1"]), "Fri 18:00");
  // Data order does not leak into the rendering.
  const reversed = buildPaletteEntries({
    "Z100.01": { days: ["Th", "M"], hours: [2, 1] },
  })[0];
  assert.equal(describeSchedule(reversed), "Mon 09:00 · Thu 10:00");
  // Labels are injectable for i18n.
  assert.equal(
    describeSchedule(reversed, { dayLabels: { M: "Pzt", Th: "Per" } }),
    "Pzt 09:00 · Per 10:00",
  );
  assert.equal(slotToClock(1), "09:00");
  assert.equal(slotToClock(14), "22:00");
});

test("sibling sections with the same instructor render distinguishably", () => {
  // The reported defect: five MATH101 rows, two pairs sharing an instructor.
  const entries = buildPaletteEntries(richData);
  const rows = searchPalette(entries, "calculus").map(
    (e) => `${e.courseName} ${e.instructor} ${describeSchedule(e)}`,
  );
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows).size, rows.length);
  assert.notEqual(describeSchedule(entries[0]), describeSchedule(entries[1]));
});

test("malformed meeting arrays keep days/hours/rooms index-aligned", () => {
  const entry = buildPaletteEntries({
    "X100.01": {
      name: "X",
      days: ["M", "T", ""],
      hours: [3, "bad", 5],
      rooms: ["A"],
    },
  })[0];
  assert.deepEqual(entry.days, ["M"]);
  assert.deepEqual(entry.hours, [3]);
  assert.deepEqual(entry.rooms, ["A"]);
  assert.equal(entry.days.length, entry.hours.length);
  assert.equal(entry.hours.length, entry.rooms.length);
});

test("multi-token queries AND across code, title and section key", () => {
  const entries = buildPaletteEntries(richData);

  const calc1 = searchPalette(entries, "calc 1");
  assert.deepEqual(new Set(calc1.map((e) => e.code)), new Set(["MATH101"]));
  assert.equal(calc1.length, 3, "all three sections of the matched course");

  // "lab" only lives in the section key, so the lecture is filtered out.
  const lab = searchPalette(entries, "cmpe150 lab");
  assert.deepEqual(lab.map((e) => e.courseName), ["CMPE150.01 LAB 1"]);

  // A spaced-out code still ranks as an exact code hit.
  const spaced = searchPalette(entries, "math 101");
  assert.deepEqual(new Set(spaced.map((e) => e.code)), new Set(["MATH101"]));

  // One dropped letter still finds the course; unrelated codes do not.
  const typo = searchPalette(entries, "mth101");
  assert.deepEqual(new Set(typo.map((e) => e.code)), new Set(["MATH101"]));

  // Every token must match something.
  assert.deepEqual(searchPalette(entries, "calc zzz"), []);
});

test("ranking is deterministic for repeated identical input", () => {
  const entries = buildPaletteEntries(richData);
  const first = searchPalette(entries, "01").map((e) => e.courseName);
  const second = searchPalette(entries, "01").map((e) => e.courseName);
  const rebuilt = searchPalette(buildPaletteEntries(richData), "01").map(
    (e) => e.courseName,
  );
  assert.deepEqual(second, first);
  assert.deepEqual(rebuilt, first);
  // Score first, then first-appearance order; sections keep dataset order.
  assert.deepEqual(first, [
    "MATH101.01",
    "MATH101.02",
    "MATH101.03",
    "AD251.01 P.S. 1",
    "CMPE150.01",
    "CMPE150.01 LAB 1",
  ]);
});

test("limit counts courses and never truncates a course's sections", () => {
  const entries = buildPaletteEntries(richData);
  const oneCourse = searchPalette(entries, "01", 1);
  assert.deepEqual(oneCourse.map((e) => e.courseName), [
    "MATH101.01",
    "MATH101.02",
    "MATH101.03",
  ]);
  // maxSections only ever drops whole courses.
  const capped = searchPalette(entries, "01", 8, 4);
  assert.deepEqual(new Set(capped.map((e) => e.code)), new Set(["MATH101", "AD251"]));
});

test("groupPaletteResults folds contiguous runs into course groups", () => {
  const entries = buildPaletteEntries(richData);
  const groups = groupPaletteResults(searchPalette(entries, "01"));
  assert.deepEqual(groups.map((g) => g.code), ["MATH101", "AD251", "CMPE150"]);
  assert.equal(groups[0].title, "CALCULUS I");
  assert.equal(groups[0].sections.length, 3);
  assert.equal(groups[2].sections.length, 2);
  assert.deepEqual(groupPaletteResults([]), []);
});

test("missing quota data does not break entry construction", () => {
  const omitted = buildPaletteEntries(richData);
  for (const entry of omitted) {
    assert.equal(entry.quota.status, "unknown");
    assert.equal(entry.quota.left, null);
    assert.equal(entry.quota.cap, null);
  }
  const explicitNull = buildPaletteEntries(richData, null);
  assert.deepEqual(
    explicitNull.map((e) => e.quota.status),
    omitted.map((e) => e.quota.status),
  );
  // An empty quota map is not "zero seats" either.
  const empty = keyed(buildPaletteEntries(richData, {}));
  assert.equal(empty["MATH101.01"].quota.status, "unknown");
});

test("quota rows are summed and over-enrolment reads as full", () => {
  const quota = {
    "MATH101.01": {
      cap: 110,
      rows: [{ dept: "ALL", status: "ALL", quota: 100, current: 134 }],
      surname: [],
    },
    "MATH101.02": {
      cap: 60,
      rows: [
        { dept: "MATH", status: "ALL", quota: 30, current: 10 },
        { dept: "ALL", status: "ALL", quota: 30, current: 20 },
      ],
    },
    "MATH101.03": { cap: null, rows: [] },
  };
  const byKey = keyed(buildPaletteEntries(richData, quota));
  assert.deepEqual(byKey["MATH101.01"].quota, {
    status: "full",
    left: -24,
    cap: 110,
    enrolled: 134,
  });
  assert.deepEqual(byKey["MATH101.02"].quota, {
    status: "open",
    left: 30,
    cap: 60,
    enrolled: 30,
  });
  // Compacted record with no usable rows, and a section absent from the file.
  assert.equal(byKey["MATH101.03"].quota.status, "unknown");
  assert.equal(byKey["CMPE150.01"].quota.status, "unknown");
});

test("summarizeQuota degrades instead of inventing zeroes", () => {
  assert.equal(summarizeQuota(undefined).status, "unknown");
  assert.equal(summarizeQuota(null).status, "unknown");
  assert.deepEqual(summarizeQuota({}), {
    status: "unknown",
    left: null,
    cap: null,
    enrolled: null,
  });
  // Compacted: cap known, rows dropped -> capacity reported, status unknown.
  assert.deepEqual(summarizeQuota({ cap: 40 }), {
    status: "unknown",
    left: null,
    cap: 40,
    enrolled: null,
  });
  // No cap: fall back to the summed per-department quotas.
  assert.deepEqual(summarizeQuota({ rows: [{ quota: 30, current: 30 }] }), {
    status: "full",
    left: 0,
    cap: null,
    enrolled: 30,
  });
  // Numeric strings from the scrape are accepted.
  assert.deepEqual(
    summarizeQuota({ cap: "40", rows: [{ quota: "40", current: "39" }] }),
    { status: "open", left: 1, cap: 40, enrolled: 39 },
  );
  // Junk rows are skipped, not counted.
  assert.equal(
    summarizeQuota({ cap: 10, rows: [null, { quota: null, current: null }] })
      .status,
    "unknown",
  );
});

test("uniqueRooms dedupes in meeting order", () => {
  const byKey = keyed(buildPaletteEntries(richData));
  assert.deepEqual(uniqueRooms(byKey["MATH101.01"]), ["HD 101", "NH 101"]);
  assert.deepEqual(uniqueRooms(byKey["AD251.01 P.S. 1"]), []);
});
