/**
 * Pure conflict-free schedule solver.
 *
 * Given the user's currently selected section keys and the semester data map,
 * try to swap each selection for a same-course section so that no two chosen
 * sections occupy the same day+hour. The search is plain depth-first
 * backtracking over one requirement per selected key.
 *
 * Determinism is a contract, not an accident: groups are built from
 * `Object.keys(data).sort()` and requirements are visited in the order of
 * `selected`, so the same input always yields the same schedule.
 */

/**
 * @typedef {{ days?: string[], hours?: number[] }} ConflictSlots
 * A section's occupied slots. `days[i]` and `hours[i]` are parallel arrays:
 * index `i` is one weekly meeting. Sections with no scheduled meeting (about
 * 44% of a live semester: theses, internships, non-timetabled seminars) carry
 * empty arrays and never conflict with anything.
 */

/**
 * Maximum number of candidate trials (nodes expanded) a single solve may use.
 *
 * Why a budget at all: the search is exponential in the number of selected
 * courses and runs synchronously on the main thread from a button click, so an
 * adversarial-but-legal selection could freeze the tab indefinitely.
 *
 * Why this number: a realistic selection is 5-10 courses, and the largest
 * candidate group in a live semester is 60 sections (TK221), though almost all
 * are 1-4. Measured against `public/data/2026-2027-1.json`, selecting one
 * section from each of the ten largest groups solves in ~1.4ms; a genuinely
 * unsatisfiable 10-course selection drawn from a pool of only 7 distinct hours
 * — far denser than any real timetable — needs ~1.3M trials to refute
 * exhaustively. 200k therefore sits well above every input a student can
 * actually produce, while burning the full budget costs ~20ms of main-thread
 * work even with three weekly meetings per section.
 */
export const SOLVER_TRIAL_BUDGET = 200_000;

/**
 * Strip a trailing `.NN` section suffix to get the key of the group of
 * interchangeable sections.
 *
 * Note that this only fires on keys that *end* in `.NN`. Sub-section keys such
 * as `"CMPE150.04 LAB 1"` or `"AD251.01 P.S. 1"` are returned unchanged and so
 * each form a group of one. That is deliberate under the current key scheme:
 * a lab is tied to its parent lecture section, so `LAB 1` and `LAB 2` of the
 * same lecture are not freely interchangeable the way `.01` and `.02` are, and
 * the solver has no way to express that coupling. The practical consequence is
 * that the solver never reshuffles labs or problem sessions.
 *
 * @param {string} key
 * @returns {string}
 */
export function groupKey(key) {
  return key.replace(/\.(\d+)$/, "");
}

/**
 * Do two sections share a day+hour slot?
 *
 * @param {ConflictSlots} a
 * @param {ConflictSlots} b
 * @returns {boolean}
 */
export function conflicts(a, b) {
  if (!a.days || !a.hours || !b.days || !b.hours) {
    return false;
  }
  for (let i = 0; i < a.days.length; i++) {
    for (let j = 0; j < b.days.length; j++) {
      if (a.days[i] === b.days[j] && a.hours[i] === b.hours[j]) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @typedef {{ ok: true, schedule: string[] }} SolveOk
 */

/**
 * @typedef {{ ok: false, reason: "unsatisfiable" | "budget-exhausted", blockedOn: string }} SolveFailure
 * `reason` separates two facts that must never be conflated: `"unsatisfiable"`
 * means the whole search tree was explored and no combination works;
 * `"budget-exhausted"` means the search was cut off and the answer is unknown.
 * Both variants carry `blockedOn` so callers that only render a message keep
 * working, but a caller that reports "no combination exists" for
 * `"budget-exhausted"` is telling the user something we did not prove.
 */

/**
 * @typedef {SolveOk | SolveFailure} SolveResult
 */

/**
 * Pick one non-conflicting section per selected course group.
 *
 * @param {string[]} selected Currently selected section keys.
 * @param {Record<string, ConflictSlots>} data Semester data, keyed by section.
 * @param {number} [budget] Candidate-trial ceiling; defaults to
 *   {@link SOLVER_TRIAL_BUDGET}. Injectable so callers that move the solve off
 *   the main thread can afford a larger search.
 * @returns {SolveResult}
 */
export function solveConflictFree(selected, data, budget = SOLVER_TRIAL_BUDGET) {
  // Group all data keys by their group key, preserving sorted data order.
  /** @type {Record<string, string[]>} */
  const groups = {};
  for (const k of Object.keys(data).sort()) {
    const g = groupKey(k);
    (groups[g] ??= []).push(k);
  }

  // Each selected key is one requirement; candidates are its group members.
  // Order follows the order of `selected` for determinism.
  const requirements = selected.map((key) => ({
    originalKey: key,
    candidates: groups[groupKey(key)] ?? [key],
  }));

  /** @type {string[]} */
  const schedule = [];
  /** @type {string | null} */
  let deepestFailedKey = null;
  let deepestFailedDepth = -1;

  // Budget state. `exhaustedKey` records the requirement we were working on
  // when the budget ran out — the deepest frame, since that is where the
  // counter trips.
  let trials = 0;
  let exhausted = false;
  /** @type {string | null} */
  let exhaustedKey = null;

  /**
   * @param {number} index
   * @returns {boolean}
   */
  function backtrack(index) {
    if (index === requirements.length) {
      return true;
    }
    const req = requirements[index];
    for (const candidate of req.candidates) {
      if (trials >= budget) {
        exhausted = true;
        exhaustedKey ??= req.originalKey;
        return false;
      }
      trials++;
      const info = data[candidate];
      const clash = schedule.some((chosen) => conflicts(info, data[chosen]));
      if (!clash) {
        schedule.push(candidate);
        if (backtrack(index + 1)) {
          return true;
        }
        schedule.pop();
        // Unwind straight out on exhaustion: this frame's candidates were not
        // all refuted, so it must not be recorded as a failure point.
        if (exhausted) {
          return false;
        }
      }
    }
    if (deepestFailedDepth <= index) {
      deepestFailedDepth = index;
      deepestFailedKey = req.originalKey;
    }
    return false;
  }

  if (backtrack(0)) {
    return { ok: true, schedule };
  }
  if (exhausted) {
    return {
      ok: false,
      reason: "budget-exhausted",
      blockedOn: exhaustedKey ?? selected[0] ?? "",
    };
  }
  return {
    ok: false,
    reason: "unsatisfiable",
    blockedOn: deepestFailedKey ?? selected[0] ?? "",
  };
}
