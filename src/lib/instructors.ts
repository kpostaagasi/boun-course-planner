export {
  buildInstructorIndex,
  findInstructors,
  instructorsForCourse,
  matchInstructorQuery,
  normalizeInstructorName,
} from "./instructors.mjs";

export type SectionRecord = {
  instructor?: string;
  name?: string;
  code?: string;
  days?: string[];
  hours?: number[];
  rooms?: string[];
};

export type TermDataset = {
  term: string;
  data: Record<string, SectionRecord>;
};

export type InstructorSection = {
  sectionKey: string;
  code: string;
  name: string;
  days: string[];
  hours: number[];
  rooms: string[];
};

export type InstructorCourse = {
  code: string;
  name: string;
  terms: string[];
  sectionKeys: string[];
};

export type InstructorEntry = {
  key: string;
  display: string;
  variants: string[];
  sections: InstructorSection[];
  courses: InstructorCourse[];
  terms: string[];
};

export type InstructorIndex = {
  terms: string[];
  byKey: Record<string, InstructorEntry>;
  keys: string[];
  courseToKeys: Record<string, string[]>;
  placeholderSections: number;
};

export type InstructorCredit = {
  key: string;
  display: string;
  terms: string[];
  sectionKeys: string[];
};
