import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTimetableLayout,
  assignSubColumns,
  colorIndexFor,
  courseColor,
  slotToHour,
  DAYS,
  DAY_LABEL_KEYS,
  PALETTE,
  MIN_LAST_HOUR,
} from "../../../src/lib/timetableLayout.mjs";

/** Slots are 1-based; slot 1 == 09:00. */
const data = {
  // Mon 09:00-11:00 (3 hours), Wed 09:00
  "CMPE101.01": { days: ["M", "M", "M", "W"], hours: [1, 2, 3, 1] },
  // Mon 09:00 only -> clashes with CMPE101.01's first hour
  "CMPE101.01 LAB 1": { days: ["M"], hours: [1] },
  // Mon 09:00 too -> three-way clash at Mon 09:00
  "CMPE101.01 LAB 2": { days: ["M"], hours: [1] },
  // Fri 14:00, no clash
  "CMPE150.01": { days: ["F"], hours: [6] },
  // unscheduled: 42.5% of the dataset looks like this
  "HIST105.01": { days: [], hours: [] },
  "HIST105.02": { days: null, hours: null },
  "HIST105.03": {},
  // Saturday 10:00
  "TK221.01": { days: ["St"], hours: [2] },
  // late course: slot 13 == 21:00
  "EE583.01": { days: ["T"], hours: [13] },
  // index-aligned junk: M/slot 0 and Q/slot 5 are dropped, W/slot 2 survives
  "BAD999.01": { days: ["M", "W", "Q"], hours: [0, 2, 5] },
};

const dayIdx = (d) => DAYS.indexOf(d);
const cell = (layout, day, hour) =>
  layout.rows.find((r) => r.hour === hour).cells[dayIdx(day)];
const occ = (layout, day, hour, course) =>
  cell(layout, day, hour).find((o) => o.course === course);

test("a lone occupant gets the full cell width", () => {
  const layout = buildTimetableLayout(["CMPE150.01"], data);
  const boxes = cell(layout, "F", 14);
  assert.equal(boxes.length, 1);
  assert.deepEqual(
    { col: boxes[0].col, cols: boxes[0].cols },
    { col: 0, cols: 1 },
  );
  assert.equal(layout.occupantCount, 1);
  assert.equal(layout.maxCols, 1);
});

test("N overlapping occupants get disjoint sub-columns spanning the cell", () => {
  const layout = buildTimetableLayout(
    ["CMPE101.01", "CMPE101.01 LAB 1", "CMPE101.01 LAB 2"],
    data,
  );
  const boxes = cell(layout, "M", 9);
  assert.equal(boxes.length, 3);
  assert.deepEqual(
    boxes.map((o) => o.cols),
    [3, 3, 3],
    "every occupant of a 3-way clash divides the cell into 3",
  );
  assert.deepEqual(
    boxes.map((o) => o.col).sort((a, b) => a - b),
    [0, 1, 2],
    "sub-columns are disjoint and contiguous",
  );
  assert.equal(layout.maxCols, 3);
  // Sorted by col so the DOM/canvas can emit left-to-right.
  assert.deepEqual(
    boxes.map((o) => o.col),
    [0, 1, 2],
  );
});

test("non-overlapping courses on the same day each keep the full width", () => {
  const d = {
    A: { days: ["M"], hours: [1] },
    B: { days: ["M"], hours: [5] },
    C: { days: ["M"], hours: [8] },
  };
  const layout = buildTimetableLayout(["A", "B", "C"], d);
  for (const [hour, key] of [
    [9, "A"],
    [13, "B"],
    [16, "C"],
  ]) {
    assert.deepEqual(
      { col: occ(layout, "M", hour, key).col, cols: occ(layout, "M", hour, key).cols },
      { col: 0, cols: 1 },
      `${key} should not be narrowed by an unrelated course`,
    );
  }
});

test("sub-column index is stable across every hour of a multi-hour course", () => {
  const layout = buildTimetableLayout(
    ["CMPE101.01", "CMPE101.01 LAB 1", "CMPE101.01 LAB 2"],
    data,
  );
  const spans = [9, 10, 11].map((h) => occ(layout, "M", h, "CMPE101.01"));
  assert.ok(spans.every(Boolean), "the 3-hour block appears in all three rows");
  assert.deepEqual(
    spans.map((o) => o.col),
    [0, 0, 0],
    "horizontal offset must not jump between rows",
  );
  assert.deepEqual(
    spans.map((o) => o.cols),
    [3, 3, 3],
    "the whole cluster shares one width so the band stays continuous",
  );
  // Band edges: label on the first hour, no break in between.
  assert.deepEqual(
    spans.map((o) => [o.isFirst, o.isLast]),
    [
      [true, false],
      [false, false],
      [false, true],
    ],
  );
});

test("unscheduled and unknown courses are excluded without throwing", () => {
  const layout = buildTimetableLayout(
    ["HIST105.01", "HIST105.02", "HIST105.03", "NOSUCH.99", "BAD999.01"],
    data,
  );
  // Only BAD999.01's single valid pair (W, slot 2) survives.
  assert.equal(layout.occupantCount, 1);
  assert.equal(occ(layout, "W", 10, "BAD999.01").cols, 1);
  assert.equal(layout.lastHour, MIN_LAST_HOUR, "bad slots must not stretch the grid");
  assert.equal(layout.courseOnSaturday, false);
  assert.doesNotThrow(() => buildTimetableLayout([], null));
  assert.equal(buildTimetableLayout([], null).occupantCount, 0);
});

test("Saturday is placed in the last column and flagged", () => {
  const off = buildTimetableLayout(["CMPE150.01"], data);
  assert.equal(off.courseOnSaturday, false);
  assert.equal(off.rows.every((r) => r.cells[dayIdx("St")].length === 0), true);

  const on = buildTimetableLayout(["CMPE150.01", "TK221.01"], data);
  assert.equal(on.courseOnSaturday, true);
  assert.equal(dayIdx("St"), DAYS.length - 1);
  assert.deepEqual(
    cell(on, "St", 10).map((o) => o.course),
    ["TK221.01"],
  );
});

test("hour range is 09:00 through max(16, latest course hour)", () => {
  const empty = buildTimetableLayout([], data);
  assert.equal(empty.rows[0].hour, 9);
  assert.equal(empty.lastHour, 16);
  assert.equal(empty.rows.at(-1).hour, 16);
  assert.equal(empty.rows.length, 8);

  // An early-only selection still renders down to 16:00.
  const early = buildTimetableLayout(["CMPE101.01"], data);
  assert.equal(early.lastHour, 16);

  // slot 13 -> 21:00 extends the grid.
  const late = buildTimetableLayout(["EE583.01"], data);
  assert.equal(late.lastHour, 21);
  assert.equal(late.rows.at(-1).hour, 21);
  assert.equal(late.rows.length, 13);
  assert.equal(slotToHour(1), 9);
  assert.equal(slotToHour(14), 22);
});

test("the hovered course is previewed unless it is already selected", () => {
  const hovered = buildTimetableLayout(["CMPE101.01"], data, "CMPE101.01 LAB 1");
  assert.equal(cell(hovered, "M", 9).length, 2);
  assert.deepEqual(
    cell(hovered, "M", 9).map((o) => o.cols),
    [2, 2],
  );

  // Hovering something already selected must not duplicate it.
  const dupe = buildTimetableLayout(["CMPE101.01"], data, "CMPE101.01");
  assert.equal(cell(dupe, "M", 9).length, 1);
});

test("assignSubColumns is deterministic regardless of insertion order", () => {
  const forward = assignSubColumns(
    new Map([
      ["A", new Set([9, 10])],
      ["B", new Set([10])],
      ["C", new Set([12])],
    ]),
  );
  const reverse = assignSubColumns(
    new Map([
      ["C", new Set([12])],
      ["B", new Set([10])],
      ["A", new Set([9, 10])],
    ]),
  );
  const flat = (m) => [...m.entries()].map(([k, v]) => [k, v.col, v.cols]).sort();
  assert.deepEqual(flat(forward), flat(reverse));
  assert.deepEqual(flat(forward), [
    ["A", 0, 2],
    ["B", 1, 2],
    ["C", 0, 1],
  ]);
});

test("palette is a single source of truth for DOM classes and canvas hexes", () => {
  assert.equal(PALETTE.length, 12);
  for (const entry of PALETTE) {
    for (const field of ["bg", "text", "border"]) {
      assert.ok(
        entry[field].includes(`-${entry.family}-`),
        `${field} of ${entry.family} must belong to its own colour family`,
      );
    }
    for (const field of ["fill", "ink", "accent"]) {
      assert.match(entry[field], /^#[0-9a-f]{6}$/, `${entry.family}.${field}`);
    }
  }
  // Same index for the DOM and the PNG, so they can never disagree.
  assert.equal(courseColor("CMPE150.01"), PALETTE[colorIndexFor("CMPE150.01")]);
  assert.ok(colorIndexFor("") >= 0 && colorIndexFor("") < PALETTE.length);
  assert.equal(DAY_LABEL_KEYS.length, DAYS.length);
});
