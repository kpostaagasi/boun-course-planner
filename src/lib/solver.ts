export {
  groupKey,
  conflicts,
  solveConflictFree,
  scoreSchedule,
  solveAll,
  SOLVER_TRIAL_BUDGET,
} from "./solver.mjs";

export type ConflictSlots = { days?: string[]; hours?: number[] };

export type SolverPrefs = {
  freeDays?: string[];
  noEarly?: boolean;
  fewerDays?: boolean;
  avoidSlots?: boolean[][];
};

export type SolveAllOk = {
  ok: true;
  options: { schedule: string[]; score: number; campusDays: number }[];
  truncated: boolean;
};

/**
 * `reason` distinguishes a proven "no combination exists" from a search that
 * hit its trial budget and simply does not know. Callers rendering a message
 * MUST branch on it.
 */
export type SolveResult =
  | { ok: true; schedule: string[] }
  | { ok: false; reason: "unsatisfiable" | "budget-exhausted"; blockedOn: string };


export type SolveAllResult = SolveAllOk | Extract<SolveResult, { ok: false }>;