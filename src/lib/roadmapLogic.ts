export {
  ECTS_OVERLOAD_THRESHOLD,
  checkRoadmapPrereqs,
  courseCatalog,
  termLoad,
  termCredits,
  termEcts,
  sortTermsNewestFirst,
} from "./roadmapLogic.mjs";

export type PrereqEntry = { prereqs: string[] };

export type PrereqsMap = Record<string, PrereqEntry>;

export type RoadmapPrereqResult = { ok: boolean; missing: string[] };

export type RoadmapPrereqReport = Record<string, Record<string, RoadmapPrereqResult>>;

export type CatalogEntry = {
  name: string;
  credits: number | undefined;
  ects: number | undefined;
};

export type CourseCatalog = Record<string, CatalogEntry>;

export type TermLoad = { credits: number; ects: number; overload: boolean };
