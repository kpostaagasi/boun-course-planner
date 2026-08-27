import test from "node:test";
import { termHistory } from "../../../src/lib/termHistory.mjs";
import assert from "node:assert/strict";

test("empty archive yields sparse with no seasons", () => {
  assert.deepEqual(termHistory([]), { count: 0, seasons: [], pattern: "sparse" });
  assert.deepEqual(termHistory(null), { count: 0, seasons: [], pattern: "sparse" });
});

test("offered every term of each year -> every", () => {
  const r = termHistory(["2024-2025-1", "2024-2025-2", "2025-2026-1", "2025-2026-2"]);
  assert.equal(r.count, 4);
  assert.deepEqual(r.seasons, [1, 2]);
  assert.equal(r.pattern, "every");
});

test("offered once per academic year -> yearly", () => {
  const r = termHistory(["2023-2024-1", "2024-2025-1", "2025-2026-1"]);
  assert.equal(r.count, 3);
  assert.deepEqual(r.seasons, [1]);
  assert.equal(r.pattern, "yearly");
});

test("skipped years -> sparse", () => {
  const r = termHistory(["2020-2021-2", "2024-2025-2"]);
  assert.equal(r.pattern, "sparse");
  assert.deepEqual(r.seasons, [2]);
});

test("malformed keys are ignored", () => {
  const r = termHistory(["bogus", "2024-2025-1"]);
  assert.equal(r.count, 1);
  assert.equal(r.pattern, "yearly");
});

test("a single-season archive is never 'every'", () => {
  // futureTerms re-runs termHistory over one season's offerings; a course
  // cannot run twice in the same season of one academic year, so the seasonal
  // pattern is always "yearly" or "sparse".
  const r = termHistory(["2022-2023-2", "2023-2024-2", "2024-2025-2"]);
  assert.equal(r.count, 3);
  assert.deepEqual(r.seasons, [2]);
  assert.equal(r.pattern, "yearly");
});

test("one skipped year makes an otherwise-yearly course sparse", () => {
  // Documents why offering prediction weighs coverage as well as `pattern`:
  // 8 of 9 Springs still reads as "sparse" here.
  const r = termHistory([
    "2017-2018-2",
    "2018-2019-2",
    "2019-2020-2",
    "2020-2021-2",
    "2021-2022-2",
    "2022-2023-2",
    "2023-2024-2",
    "2025-2026-2",
  ]);
  assert.equal(r.count, 8);
  assert.equal(r.pattern, "sparse");
});
