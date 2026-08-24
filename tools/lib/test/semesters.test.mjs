import assert from "node:assert/strict";
import { test } from "node:test";

import { candidateSemesters, semestersToSync } from "../semesters.mjs";

test("candidateSemesters covers previous and current academic year", () => {
  const candidates = candidateSemesters(new Date("2026-08-24T12:00:00Z"));
  // August 2026 -> academic start 2026; probes 2024/2025..2026/2027 terms? No:
  // academicStart = 2026, so [2025, 2026] starts.
  assert.deepEqual(candidates, [
    "2025/2026-1", "2025/2026-2", "2025/2026-3",
    "2026/2027-1", "2026/2027-2", "2026/2027-3",
  ]);
});

const PUBLISHED = ["2025/2026-1", "2025/2026-2", "2025/2026-3", "2026/2027-1"];

test("syncs the newest published term in summer break", () => {
  const sync = semestersToSync(PUBLISHED, new Date("2026-08-10T12:00:00Z"));
  // Newest is 2026/2027-1 (fall published in August).
  assert.deepEqual(sync, ["2026/2027-1"]);
});

test("syncs the active fall term mid-semester", () => {
  const sync = semestersToSync(["2025/2026-1", "2025/2026-2"], new Date("2025-10-15T12:00:00Z"));
  assert.deepEqual(sync, ["2025/2026-2"]);
});

test("prefers the newly published spring term while fall still runs", () => {
  // January overlap: fall window active, spring just published.
  const sync = semestersToSync(["2025/2026-1", "2025/2026-2"], new Date("2026-01-20T12:00:00Z"));
  assert.deepEqual(sync, ["2025/2026-2"]);
});

test("handles empty publication list", () => {
  assert.deepEqual(semestersToSync([], new Date()), []);
});
