export {
  GRADE_POINTS,
  GRADES,
  RETAKEABLE_GRADES,
  gradePoint,
  computeTermStats,
  computeCumulativeStats,
} from "./gpa.mjs";

/** One course as the GPA arithmetic sees it: credits and a grade, nothing else. */
export type GpaCourse = {
  credits: number | undefined;
  grade: string;
};

/** A course being repeated, and the grade the new attempt replaces. */
export type Retake = {
  credits: number | undefined;
  oldGrade: string;
};

/** The cumulative record a student carries into this term. */
export type Baseline = {
  gpa: number;
  credits: number;
};

/**
 * `gpa` is `null` when nothing has been graded yet — render it as unknown, not
 * as 0.00.
 */
export type TermStats = {
  points: number;
  gpaCredits: number;
  totalCredits: number;
  gpa: number | null;
};

export type CumulativeStats = {
  gpa: number | null;
  gpaCredits: number;
  points: number;
  totalCredits: number;
  previousCreditsKept: number;
  retakeCreditsRemoved: number;
};
