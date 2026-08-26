export { termHistory } from "./termHistory.mjs";

export type TermHistoryPattern = "every" | "yearly" | "sparse";

export type TermHistoryResult = {
  count: number;
  seasons: number[];
  pattern: TermHistoryPattern;
};
