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
