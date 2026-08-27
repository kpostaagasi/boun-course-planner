export {
  DAYS,
  DAY_LABEL_KEYS,
  FIRST_SLOT,
  LAST_SLOT,
  FIRST_HOUR,
  MIN_LAST_HOUR,
  PALETTE,
  slotToHour,
  colorIndexFor,
  courseColor,
  assignSubColumns,
  buildTimetableLayout,
} from "./timetableLayout.mjs";

export type Day = "M" | "T" | "W" | "Th" | "F" | "St";

export type SectionSchedule = {
  days?: string[] | null;
  hours?: number[] | null;
};

/**
 * `bg`/`text`/`border` are literal Tailwind class strings for the DOM;
 * `fill`/`ink`/`accent` are the light-mode hex values of those same classes,
 * used by the canvas PNG export. One entry, one hue, no drift.
 */
export type PaletteEntry = {
  family: string;
  bg: string;
  text: string;
  border: string;
  fill: string;
  ink: string;
  accent: string;
};

export type Occupant = {
  course: string;
  col: number;
  cols: number;
  isFirst: boolean;
  isLast: boolean;
  color: number;
};

export type LayoutRow = {
  hour: number;
  cells: Occupant[][];
};

export type Layout = {
  rows: LayoutRow[];
  courseOnSaturday: boolean;
  lastHour: number;
  maxCols: number;
  occupantCount: number;
};
