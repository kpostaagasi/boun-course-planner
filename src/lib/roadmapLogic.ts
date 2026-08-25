export {
  checkRoadmapPrereqs,
  termCredits,
  sortTermsNewestFirst,
} from "./roadmapLogic.mjs";

export type PrereqEntry = { prereqs: string[] };

export type PrereqsMap = Record<string, PrereqEntry>;

export type RoadmapPrereqResult = { ok: boolean; missing: string[] };

export type RoadmapPrereqReport = Record<string, Record<string, RoadmapPrereqResult>>;
