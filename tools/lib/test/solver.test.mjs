import test from "node:test";
import assert from "node:assert/strict";
import {
  groupKey,
  conflicts,
  solveConflictFree,
  SOLVER_TRIAL_BUDGET,
} from "../../../src/lib/solver.mjs";

/** Two courses, two sections each; `.01` of both collide on Monday hour 1. */
const swappable = {
  "A100.01": { days: ["M"], hours: [1] },
  "A100.02": { days: ["M"], hours: [2] },
  "B200.01": { days: ["M"], hours: [1] },
  "B200.02": { days: ["M"], hours: [3] },
};

/** Two labs of the same lecture section: singleton groups, mutual clash. */
const deadLabs = {
  "CMPE101.01 LAB 1": { days: ["M"], hours: [1] },
  "CMPE101.01 LAB 2": { days: ["M"], hours: [1] },
};

/**
 * `groups` courses of `sections` sections each, all drawn from a pool of
 * `hours` Monday slots. With `groups > hours` this is unsatisfiable by
 * pigeonhole, but the tree is large enough to blow a trial budget.
 * @param {number} groups
 * @param {number} sections
 * @param {number} hours
 */
function densePool(groups, sections, hours) {
  /** @type {Record<string, { days: string[], hours: number[] }>} */
  const data = {};
  for (let g = 0; g < groups; g++) {
    for (let s = 1; s <= sections; s++) {
      data[`X${g}.${String(s).padStart(2, "0")}`] = {
        days: ["M"],
        hours: [(g + s) % hours],
      };
    }
  }
  const selected = Array.from({ length: groups }, (_, g) => `X${g}.01`);
  return { data, selected };
}

test("groupKey strips a trailing .NN section suffix", () => {
  assert.equal(groupKey("CMPE150.01"), "CMPE150");
  assert.equal(groupKey("CMPE150.04"), "CMPE150");
  assert.equal(groupKey("MATH101.10"), "MATH101");
});

test("groupKey leaves keys without a trailing .NN suffix alone", () => {
  // No suffix at all.
  assert.equal(groupKey("CMPE150"), "CMPE150");
  // Real sub-section keys: 203 of the 3140 keys in a live semester look like
  // this. They are intentionally NOT grouped with their siblings — a lab is
  // tied to its parent lecture section, so `LAB 1` and `LAB 2` are not freely
  // interchangeable and the solver cannot model that coupling. Consequence:
  // labs and problem sessions are never reshuffled.
  assert.equal(groupKey("AD251.01 P.S. 1"), "AD251.01 P.S. 1");
  assert.equal(groupKey("CMPE150.04 LAB 1"), "CMPE150.04 LAB 1");
  assert.equal(groupKey("BIO106.01 LAB 1"), "BIO106.01 LAB 1");
});

test("conflicts is true only for a shared day+hour slot", () => {
  assert.equal(
    conflicts({ days: ["M"], hours: [3] }, { days: ["M"], hours: [3] }),
    true,
  );
  // Same day, different hour.
  assert.equal(
    conflicts({ days: ["M"], hours: [3] }, { days: ["M"], hours: [4] }),
    false,
  );
  // Different day, same hour.
  assert.equal(
    conflicts({ days: ["M"], hours: [3] }, { days: ["T"], hours: [3] }),
    false,
  );
});

test("conflicts matches any overlapping pair of multi-slot meetings", () => {
  const mwf = { days: ["M", "W", "F"], hours: [1, 2, 3] };
  assert.equal(conflicts(mwf, { days: ["F"], hours: [3] }), true);
  // Meets on F but at hour 1, while `mwf` is on F only at hour 3.
  assert.equal(conflicts(mwf, { days: ["F"], hours: [1] }), false);
});

test("conflicts is false when either side is unscheduled", () => {
  const scheduled = { days: ["M"], hours: [1] };
  // ~44% of live sections carry empty day/hour arrays.
  assert.equal(conflicts(scheduled, { days: [], hours: [] }), false);
  assert.equal(conflicts({ days: [], hours: [] }, scheduled), false);
  // Missing keys entirely.
  assert.equal(conflicts(scheduled, {}), false);
  assert.equal(conflicts({}, scheduled), false);
  assert.equal(conflicts({ days: ["M"] }, scheduled), false);
  assert.equal(conflicts({ hours: [1] }, scheduled), false);
});

test("solveConflictFree swaps a clashing selection for a clash-free one", () => {
  const result = solveConflictFree(["A100.01", "B200.01"], swappable);
  assert.equal(result.ok, true);
  assert.deepEqual(result.schedule, ["A100.01", "B200.02"]);
  // Post-condition: the returned schedule is genuinely conflict-free and every
  // entry comes from the group of the key it replaced.
  for (let i = 0; i < result.schedule.length; i++) {
    assert.equal(groupKey(result.schedule[i]), groupKey(["A100.01", "B200.01"][i]));
    for (let j = i + 1; j < result.schedule.length; j++) {
      assert.equal(
        conflicts(swappable[result.schedule[i]], swappable[result.schedule[j]]),
        false,
      );
    }
  }
});

test("solveConflictFree reports unsatisfiable selections with the blocking key", () => {
  const result = solveConflictFree(
    ["CMPE101.01 LAB 1", "CMPE101.01 LAB 2"],
    deadLabs,
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unsatisfiable");
  assert.equal(result.blockedOn, "CMPE101.01 LAB 2");
});

test("budget exhaustion is reported distinguishably from unsatisfiability", () => {
  // Same input, two budgets. 10 courses over a 7-slot pool needs ~1.3M trials
  // to refute exhaustively — well past the default ceiling.
  const { data, selected } = densePool(10, 10, 7);

  const capped = solveConflictFree(selected, data);
  assert.equal(capped.ok, false);
  assert.equal(capped.reason, "budget-exhausted");
  assert.ok(capped.blockedOn.length > 0);

  const uncapped = solveConflictFree(selected, data, Infinity);
  assert.equal(uncapped.ok, false);
  assert.equal(uncapped.reason, "unsatisfiable");

  // The whole point: the same question has two different honest answers
  // depending on how much search we were allowed to do.
  assert.notEqual(capped.reason, uncapped.reason);
});

test("the default budget is not tripped by a realistic solvable selection", () => {
  // Anything a student can actually select must be answered, not abandoned.
  assert.equal(SOLVER_TRIAL_BUDGET, 200_000);
  const result = solveConflictFree(["A100.01", "B200.01"], swappable, 4);
  assert.equal(result.ok, true);
});

test("budget counts candidate trials and cuts off at the boundary", () => {
  // One trial is spent on `LAB 1`, so the second requirement's first trial is
  // the one refused.
  const cut = solveConflictFree(
    ["CMPE101.01 LAB 1", "CMPE101.01 LAB 2"],
    deadLabs,
    1,
  );
  assert.equal(cut.ok, false);
  assert.equal(cut.reason, "budget-exhausted");
  assert.equal(cut.blockedOn, "CMPE101.01 LAB 2");

  // With room for both trials the same input is proven unsatisfiable.
  const proven = solveConflictFree(
    ["CMPE101.01 LAB 1", "CMPE101.01 LAB 2"],
    deadLabs,
    2,
  );
  assert.equal(proven.ok, false);
  assert.equal(proven.reason, "unsatisfiable");
});

test("solveConflictFree is deterministic across runs and data key order", () => {
  const selected = ["A100.01", "B200.01"];
  const first = solveConflictFree(selected, swappable);
  const second = solveConflictFree(selected, swappable);
  assert.deepEqual(first, second);

  // Groups are built from sorted keys, so insertion order must not matter.
  /** @type {Record<string, { days: string[], hours: number[] }>} */
  const reversed = {};
  for (const k of Object.keys(swappable).reverse()) reversed[k] = swappable[k];
  assert.notDeepEqual(Object.keys(reversed), Object.keys(swappable));
  assert.deepEqual(solveConflictFree(selected, reversed), first);

  // Requirement order follows `selected`, so a different selection order is
  // allowed to yield a different (still deterministic) schedule.
  const flipped = solveConflictFree(["B200.01", "A100.01"], swappable);
  assert.equal(flipped.ok, true);
  assert.deepEqual(flipped.schedule, ["B200.01", "A100.02"]);
});
