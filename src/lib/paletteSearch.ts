export {
  buildPaletteEntries,
  searchPalette,
  groupPaletteResults,
  describeSchedule,
  summarizeQuota,
  uniqueRooms,
  slotToClock,
  DAY_CODES,
  DAY_NAMES,
  UNSCHEDULED_LABEL,
} from "./paletteSearch.mjs";

export type PaletteQuota = {
  status: "open" | "full" | "unknown";
  /** Seats left; negative when the section is over-enrolled. */
  left: number | null;
  cap: number | null;
  enrolled: number | null;
};

export type PaletteEntry = {
  /** Section key, e.g. "CMPE210.01" or "CMPE150.04 LAB 1". */
  courseName: string;
  /** Base code, e.g. "CMPE210". */
  code: string;
  /** Everything after the first dot, e.g. "01" or "04 LAB 1". */
  section: string;
  title: string;
  instructor: string;
  /** Day codes ("M".."St"), index-aligned with `hours` and `rooms`. */
  days: string[];
  /** 1-based timetable slots; slot 1 = 09:00. */
  hours: number[];
  rooms: string[];
  scheduled: boolean;
  credits: number | null;
  quota: PaletteQuota;
  /**
   * Lowercase search index, precomputed by `buildPaletteEntries` so that
   * matching 3000+ sections per keystroke allocates nothing. Internal to
   * `searchPalette`; nothing else should read these.
   */
  _code: string;
  _title: string;
  _instructor: string;
  _key: string;
};

export type PaletteGroup = {
  code: string;
  title: string;
  sections: PaletteEntry[];
};
