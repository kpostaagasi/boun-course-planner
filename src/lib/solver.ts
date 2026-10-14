export {
  groupKey,
  conflicts,
  solveConflictFree,
  SOLVER_TRIAL_BUDGET,
} from "./solver.mjs";

export type ConflictSlots = { days?: string[]; hours?: number[] };

/**
 * `reason` distinguishes a proven "no combination exists" from a search that
 * hit its trial budget and simply does not know. Callers rendering a message
 * MUST branch on it.
 */
export type SolveResult =
  | { ok: true; schedule: string[] }
  | { ok: false; reason: "unsatisfiable" | "budget-exhausted"; blockedOn: string };
