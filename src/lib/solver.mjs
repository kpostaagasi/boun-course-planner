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

/**
 * Score a conflict-free schedule against a set of preferences.
 * Lower penalties yield higher scores (returns negative penalty).
 * @param {string[]} schedule Candidate schedule (array of section keys).
 * @param {Record<string, ConflictSlots>} data Semester data.
 * @param {{ freeDays?: string[], noEarly?: boolean, fewerDays?: boolean, avoidSlots?: boolean[][] }} prefs User preferences.
 * @returns {number}
 */
export function scoreSchedule(schedule, data, prefs) {
  let penalty = 0;
  const daysPresent = new Set();

  for (const key of schedule) {
    const info = data[key];
    if (!info || !info.days || !info.hours) continue;

    for (let i = 0; i < info.days.length; i++) {
      /** @type {string} */
      const day = info.days[i];
      /** @type {number} */
      const hour = info.hours[i];

      daysPresent.add(day);

      if (prefs.freeDays && prefs.freeDays.includes(day)) {
        penalty += 1;
      }

      if (prefs.noEarly && hour === 1) {
        penalty += 1;
      }

      if (prefs.avoidSlots) {
        const dayIdx = ["M", "T", "W", "Th", "F", "St"].indexOf(day);
        const hourIdx = hour - 1;
        if (
          dayIdx >= 0 &&
          hourIdx >= 0 &&
          prefs.avoidSlots[dayIdx] &&
          prefs.avoidSlots[dayIdx][hourIdx] === false
        ) {
          penalty += 1;
        }
      }
    }
  }

  if (prefs.fewerDays) {
    penalty += daysPresent.size;
  }

  return penalty === 0 ? 0 : -penalty;
}

/**
 * Find and rank alternative conflict-free schedules.
 * @param {string[]} selected Currently selected section keys.
 * @param {Record<string, ConflictSlots>} data Semester data.
 * @param {{ limit?: number, prefs?: object, budget?: number }} [options]
 * @returns {{ ok: true, options: {schedule: string[], score: number, campusDays: number}[], truncated: boolean } | SolveFailure}
 */
export function solveAll(selected, data, { limit = 5, prefs = {}, budget = SOLVER_TRIAL_BUDGET } = {}) {
  /** @type {Record<string, string[]>} */
  const groups = {};
  for (const k of Object.keys(data).sort()) {
    const g = groupKey(k);
    (groups[g] ??= []).push(k);
  }

  const requirements = selected.map((key) => ({
    originalKey: key,
    candidates: groups[groupKey(key)] ?? [key],
  }));

  const MAX_COLLECTION = 500;
  /** @type {string[][]} */
  const collected = [];
  /** @type {string[]} */
  const schedule = [];

  let deepestFailedKey = null;
  let deepestFailedDepth = -1;
  let trials = 0;
  let exhausted = false;
  /** @type {string | null} */
  let exhaustedKey = null;

  /** @param {number} index */
  function backtrack(index) {
    if (index === requirements.length) {
      collected.push([...schedule]);
      return true;
    }
    if (collected.length >= MAX_COLLECTION) {
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
        backtrack(index + 1);
        schedule.pop();
        if (exhausted) {
          return false;
        }
        if (collected.length >= MAX_COLLECTION) {
          return true;
        }
      }
    }
    if (collected.length === 0 && deepestFailedDepth <= index) {
      deepestFailedDepth = index;
      deepestFailedKey = req.originalKey;
    }
    return false;
  }

  backtrack(0);

  if (collected.length > 0) {
    const scored = collected.map((sch) => {
      const score = scoreSchedule(sch, data, prefs);
      const daysPresent = new Set();
      for (const key of sch) {
        const info = data[key];
        if (info && info.days) {
          for (const d of info.days) daysPresent.add(d);
        }
      }
      return { schedule: sch, score, campusDays: daysPresent.size };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const keyA = a.schedule.join("|");
      const keyB = b.schedule.join("|");
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });

    return {
      ok: true,
      options: scored.slice(0, limit),
      truncated: exhausted || collected.length >= MAX_COLLECTION,
    };
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
