export {
  SEASONS_PER_YEAR,
  parseTerm,
  termOrdinal,
  formatTerm,
  compareTerms,
  toFileKey,
  toDisplayKey,
  nextTerm,
  synthesiseFutureTerms,
  confidenceRank,
  predictOffering,
  predictedCourses,
} from "./futureTerms.mjs";

export type ParsedTerm = {
  startYear: number;
  season: number;
  sep: "/" | "-";
  ordinal: number;
};

export type OfferingConfidence = "known" | "high" | "medium" | "low" | "none";

export type OfferingPattern = "every" | "yearly" | "sparse";

export type OfferingPrediction = {
  confidence: OfferingConfidence;
  likely: boolean;
  known: boolean;
  count: number;
  seasonCount: number;
  seasons: number[];
  pattern: OfferingPattern;
  seasonPattern: OfferingPattern;
  coverage: number;
  lastTerm: string | null;
  lastSeasonTerm: string | null;
  yearsSinceLast: number | null;
};

export type PredictedCourse = { code: string; prediction: OfferingPrediction };
