export {
  parseExamDate,
  parseExamSlot,
  examConflicts,
  examConflictFor,
} from "./examConflict.mjs";

/** One section's verbatim exam coordinates, as scraped. */
export type ExamSection = {
  key: string;
  examDate?: string;
  examSlot?: string;
};

export type ExamClash = {
  a: string;
  b: string;
  /** Canonical `YYYY-MM-DD`. */
  date: string;
  slot: number;
};

export type ExamMaybe = {
  a: string;
  b: string;
  date: string;
};

export type ExamReport = {
  conflicts: ExamClash[];
  unresolved: ExamMaybe[];
  unknown: string[];
};

/**
 * `clear` is the only status that asserts absence of a clash, and it is only
 * returned when every pair was decidable. `unknown` must render as silence.
 */
export type ExamStatus = {
  status: "clash" | "maybe" | "clear" | "unknown";
  with: string[];
  compared: number;
};
