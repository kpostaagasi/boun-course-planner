import assert from "node:assert/strict";
import { test } from "node:test";

import { splitDays, splitSlots, parseSchedulePage } from "../parse.mjs";

test("splitDays splits variable-length day tokens", () => {
  assert.deepEqual(splitDays("WThTh"), ["W", "Th", "Th"]);
  assert.deepEqual(splitDays("MMT"), ["M", "M", "T"]);
  assert.deepEqual(splitDays("ThThThTh"), ["Th", "Th", "Th", "Th"]);
  assert.deepEqual(splitDays("FSt"), ["F", "St"]);
  assert.deepEqual(splitDays("Su"), ["Su"]);
});

test("splitDays rejects unknown tokens", () => {
  assert.throws(() => splitDays("X"), /Unrecognised day token/);
  assert.throws(() => splitDays("EMRE UĞUR"), /Unrecognised day token/);
});

test("splitSlots handles mixed single- and two-digit slots", () => {
  assert.deepEqual(splitSlots("8910", 3), [8, 9, 10]);
  assert.deepEqual(splitSlots("1234", 4), [1, 2, 3, 4]);
  assert.deepEqual(splitSlots("910", 2), [9, 10]);
  assert.deepEqual(splitSlots("7", 1), [7]);
  assert.deepEqual(splitSlots("1112", 2), [11, 12]);
});

test("splitSlots throws when digits cannot cover meetings", () => {
  assert.throws(() => splitSlots("8910", 4), /Cannot match/);
  assert.throws(() => splitSlots("", 1), /Cannot match/);
});
