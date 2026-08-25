// @ts-expect-error re-export of plain-JS pure logic (tested via node:test)
export { getEligibility } from "./eligibility.mjs";

export type EligibilityStatus =
  | "taken"
  | "eligible"
  | "missing-prereq"
  | "no-data";

export type EligibilityResult = {
  status: EligibilityStatus;
  missing: string[];
  moreMissing: boolean;
};
