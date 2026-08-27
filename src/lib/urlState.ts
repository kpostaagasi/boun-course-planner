export {
  buildSelectionSearch,
  decodeHistoryState,
  encodeHistoryState,
  isTermKey,
  normalizeCourses,
  parseSelectionParams,
  resolveInitialSelection,
  sameCourses,
  stripSelectionSearch,
} from "./urlState.mjs";

export type UrlSelection = {
  semester: string | null;
  courses: string[];
};

export type ResolvedSelection = {
  semester: string;
  selection: Record<string, string[]>;
  changed: boolean;
};

export type HistorySnapshot = {
  sel: { semester: string; courses: string[] };
};
