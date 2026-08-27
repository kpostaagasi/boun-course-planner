/**
 * Pure timetable layout: turn the selected (plus hovered) section keys into a
 * grid of rows, where every occupant of a day/hour cell already knows which
 * horizontal sub-column it must render in.
 *
 * Overlapping courses used to be stacked vertically, which made a single
 * four-way clash three rows tall and unreadable. Instead we do the standard
 * calendar overlap layout: per day we group courses into connected overlap
 * clusters, greedily colour each cluster, and hand every occupant a
 * `(col, cols)` pair. `col` is assigned **per (day, course)**, never per cell,
 * so a multi-hour block keeps the same horizontal offset in every hour it
 * spans and renders as one continuous vertical band.
 *
 * Colour lives here too (see `PALETTE`) so the DOM and the PNG export cannot
 * disagree about which hue a course got.
 */

/** @typedef {"M" | "T" | "W" | "Th" | "F" | "St"} Day */

/** Day column order. Stable — positional locators and the PNG rely on it. */
/** @type {readonly Day[]} */
export const DAYS = ["M", "T", "W", "Th", "F", "St"];

/** i18n keys for the day headers, index-aligned with {@link DAYS}. */
/** @type {readonly string[]} */
export const DAY_LABEL_KEYS = [
  "day.Mon",
  "day.Tue",
  "day.Wed",
  "day.Thu",
  "day.Fri",
  "day.Sat",
];

/** `hours` in the dataset are 1-based slots; slot 1 is 09:00, slot 14 is 22:00. */
export const FIRST_SLOT = 1;
export const LAST_SLOT = 14;
/** Clock hour of the first row. */
export const FIRST_HOUR = 9;
/** The grid is never shorter than 09:00–16:00, even with nothing selected. */
export const MIN_LAST_HOUR = 16;

/**
 * @param {number} slot 1-based dataset slot
 * @returns {number} clock hour
 */
export function slotToHour(slot) {
  return slot + 8;
}

/**
 * One palette entry carries both representations of a hue:
 * `bg`/`text`/`border` are full literal Tailwind class strings (the JIT
 * scanner reads this file, so they must never be composed dynamically), and
 * `fill`/`ink`/`accent` are the light-mode sRGB values of exactly those
 * classes, extracted from `tailwindcss/theme.css` — canvas needs concrete
 * colours. Keeping them in one object is what stops the PNG from drifting
 * away from the DOM.
 *
 * @typedef {object} PaletteEntry
 * @property {string} family Tailwind colour family, ties the classes to the hexes
 * @property {string} bg Tailwind background classes (light + dark)
 * @property {string} text Tailwind text colour classes (light + dark)
 * @property {string} border Tailwind left-accent border classes (light + dark)
 * @property {string} fill light-mode `-50` background, as hex
 * @property {string} ink light-mode `-800` text colour, as hex
 * @property {string} accent light-mode `-400` accent colour, as hex
 */

/** @type {readonly PaletteEntry[]} */
export const PALETTE = [
  { family: "red", bg: "bg-red-50 dark:bg-red-500/20", text: "text-red-800 dark:text-red-200", border: "border-red-400 dark:border-red-400/80", fill: "#fef2f2", ink: "#9f0712", accent: "#ff6467" },
  { family: "orange", bg: "bg-orange-50 dark:bg-orange-500/20", text: "text-orange-800 dark:text-orange-200", border: "border-orange-400 dark:border-orange-400/80", fill: "#fff7ed", ink: "#9f2d00", accent: "#ff8904" },
  { family: "amber", bg: "bg-amber-50 dark:bg-amber-500/20", text: "text-amber-800 dark:text-amber-200", border: "border-amber-400 dark:border-amber-400/80", fill: "#fffbeb", ink: "#973c00", accent: "#ffb900" },
  { family: "yellow", bg: "bg-yellow-50 dark:bg-yellow-500/20", text: "text-yellow-800 dark:text-yellow-200", border: "border-yellow-400 dark:border-yellow-400/80", fill: "#fefce8", ink: "#894b00", accent: "#fdc700" },
  { family: "lime", bg: "bg-lime-50 dark:bg-lime-500/20", text: "text-lime-800 dark:text-lime-200", border: "border-lime-400 dark:border-lime-400/80", fill: "#f7fee7", ink: "#3c6300", accent: "#9ae600" },
  { family: "emerald", bg: "bg-emerald-50 dark:bg-emerald-500/20", text: "text-emerald-800 dark:text-emerald-200", border: "border-emerald-400 dark:border-emerald-400/80", fill: "#ecfdf5", ink: "#006045", accent: "#00d492" },
  { family: "teal", bg: "bg-teal-50 dark:bg-teal-500/20", text: "text-teal-800 dark:text-teal-200", border: "border-teal-400 dark:border-teal-400/80", fill: "#f0fdfa", ink: "#005f5a", accent: "#00d5be" },
  { family: "sky", bg: "bg-sky-50 dark:bg-sky-500/20", text: "text-sky-800 dark:text-sky-200", border: "border-sky-400 dark:border-sky-400/80", fill: "#f0f9ff", ink: "#00598a", accent: "#00bcff" },
  { family: "blue", bg: "bg-blue-50 dark:bg-blue-500/20", text: "text-blue-800 dark:text-blue-200", border: "border-blue-400 dark:border-blue-400/80", fill: "#eff6ff", ink: "#193cb8", accent: "#51a2ff" },
  { family: "indigo", bg: "bg-indigo-50 dark:bg-indigo-500/20", text: "text-indigo-800 dark:text-indigo-200", border: "border-indigo-400 dark:border-indigo-400/80", fill: "#eef2ff", ink: "#372aac", accent: "#7c86ff" },
  { family: "fuchsia", bg: "bg-fuchsia-50 dark:bg-fuchsia-500/20", text: "text-fuchsia-800 dark:text-fuchsia-200", border: "border-fuchsia-400 dark:border-fuchsia-400/80", fill: "#fdf4ff", ink: "#8a0194", accent: "#ed6aff" },
  { family: "pink", bg: "bg-pink-50 dark:bg-pink-500/20", text: "text-pink-800 dark:text-pink-200", border: "border-pink-400 dark:border-pink-400/80", fill: "#fdf2f8", ink: "#a3004c", accent: "#fb64b6" },
];

/**
 * FNV-1a: spreads course names across the 12 hues better than a 31-multiplier
 * hash. Returns an index into {@link PALETTE}.
 *
 * @param {string} name
 * @returns {number}
 */
export function colorIndexFor(name) {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % PALETTE.length;
}

/**
 * @param {string} name
 * @returns {PaletteEntry}
 */
export function courseColor(name) {
  return PALETTE[colorIndexFor(name)];
}

/**
 * @typedef {object} Occupant
 * @property {string} course section key
 * @property {number} col sub-column index, 0-based; stable across the course's hours
 * @property {number} cols sub-columns to divide the cell into for this occupant
 * @property {boolean} isFirst true when the hour above is not part of this course
 * @property {boolean} isLast true when the hour below is not part of this course
 * @property {number} color index into {@link PALETTE}
 */

/**
 * @typedef {object} LayoutRow
 * @property {number} hour clock hour, e.g. 9 for the 09:00 row
 * @property {Occupant[][]} cells one entry per {@link DAYS} index, sorted by `col`
 */

/**
 * @typedef {object} Layout
 * @property {LayoutRow[]} rows 09:00 up to and including `lastHour`
 * @property {boolean} courseOnSaturday whether the Saturday column has content
 * @property {number} lastHour clock hour of the final row
 * @property {number} maxCols widest sub-column count anywhere in the grid
 * @property {number} occupantCount total rendered boxes; 0 means nothing to show
 */

/** @typedef {{ days?: string[] | null, hours?: number[] | null }} SectionSchedule */

/**
 * @param {Set<number>} set
 * @returns {number}
 */
function minOf(set) {
  let min = Infinity;
  for (const v of set) if (v < min) min = v;
  return min;
}

/**
 * @param {Set<number>} a
 * @param {Set<number>} b
 * @returns {boolean}
 */
function intersects(a, b) {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const v of small) if (large.has(v)) return true;
  return false;
}

/**
 * Greedy interval-graph colouring, one call per day column.
 *
 * Courses are grouped into connected overlap clusters; the cluster's column
 * count is shared by all its members so a course that spans several hours
 * never changes horizontal offset mid-block. Courses that do not overlap
 * anything keep the full cell width.
 *
 * @param {Map<string, Set<number>>} courses course key -> clock hours on this day
 * @returns {Map<string, { col: number, cols: number, hours: Set<number> }>}
 */
export function assignSubColumns(courses) {
  /** @type {Map<string, { col: number, cols: number, hours: Set<number> }>} */
  const result = new Map();
  // Deterministic order: earliest hour first, then key, so tests and renders agree.
  const entries = [...courses.entries()].sort((a, b) => {
    const byHour = minOf(a[1]) - minOf(b[1]);
    return byHour !== 0 ? byHour : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
  const n = entries.length;
  if (n === 0) return result;

  /** @type {number[][]} */
  const adj = entries.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let k = i + 1; k < n; k++) {
      if (intersects(entries[i][1], entries[k][1])) {
        adj[i].push(k);
        adj[k].push(i);
      }
    }
  }

  const cluster = new Int32Array(n).fill(-1);
  let clusterCount = 0;
  for (let i = 0; i < n; i++) {
    if (cluster[i] !== -1) continue;
    const id = clusterCount++;
    cluster[i] = id;
    /** @type {number[]} */
    const stack = [i];
    for (;;) {
      const cur = stack.pop();
      if (cur === undefined) break;
      for (const next of adj[cur]) {
        if (cluster[next] === -1) {
          cluster[next] = id;
          stack.push(next);
        }
      }
    }
  }

  const cols = new Int32Array(n).fill(-1);
  const clusterCols = new Int32Array(clusterCount);
  for (let i = 0; i < n; i++) {
    let col = 0;
    for (;;) {
      let taken = false;
      for (const nb of adj[i]) {
        if (cols[nb] === col) {
          taken = true;
          break;
        }
      }
      if (!taken) break;
      col++;
    }
    cols[i] = col;
    const id = cluster[i];
    if (col + 1 > clusterCols[id]) clusterCols[id] = col + 1;
  }

  // Second pass: clusterCols is only final once every member is placed.
  for (let i = 0; i < n; i++) {
    result.set(entries[i][0], {
      col: cols[i],
      cols: clusterCols[cluster[i]],
      hours: entries[i][1],
    });
  }
  return result;
}

/**
 * @param {string[]} courseNames selected section keys
 * @param {Record<string, SectionSchedule> | null | undefined} semesterData
 * @param {string} [hoveredCourse] previewed section key, "" when nothing is hovered
 * @returns {Layout}
 */
export function buildTimetableLayout(courseNames, semesterData, hoveredCourse = "") {
  /** @type {Map<string, Set<number>>[]} */
  const perDay = DAYS.map(() => new Map());
  let lastHour = MIN_LAST_HOUR;
  let courseOnSaturday = false;

  if (semesterData) {
    const names = courseNames.slice();
    if (hoveredCourse !== "" && !names.includes(hoveredCourse)) names.push(hoveredCourse);

    for (const name of names) {
      const section = semesterData[name];
      if (!section) continue;
      const days = section.days;
      const hours = section.hours;
      // 42.5% of sections are unscheduled: empty/missing days. Nothing to place.
      if (!days || !hours) continue;
      const pairs = Math.min(days.length, hours.length);
      for (let j = 0; j < pairs; j++) {
        const dayIdx = DAYS.indexOf(/** @type {Day} */ (days[j]));
        if (dayIdx < 0) continue;
        const slot = Number(hours[j]);
        if (!Number.isInteger(slot) || slot < FIRST_SLOT || slot > LAST_SLOT) continue;
        const hour = slotToHour(slot);
        let set = perDay[dayIdx].get(name);
        if (set === undefined) {
          set = new Set();
          perDay[dayIdx].set(name, set);
        }
        set.add(hour);
        if (hour > lastHour) lastHour = hour;
        if (DAYS[dayIdx] === "St") courseOnSaturday = true;
      }
    }
  }

  const placed = perDay.map(assignSubColumns);

  /** @type {LayoutRow[]} */
  const rows = [];
  let maxCols = 1;
  let occupantCount = 0;
  for (let hour = FIRST_HOUR; hour <= lastHour; hour++) {
    /** @type {Occupant[][]} */
    const cells = [];
    for (let d = 0; d < DAYS.length; d++) {
      /** @type {Occupant[]} */
      const cell = [];
      for (const [course, info] of placed[d]) {
        if (!info.hours.has(hour)) continue;
        if (info.cols > maxCols) maxCols = info.cols;
        occupantCount++;
        cell.push({
          course,
          col: info.col,
          cols: info.cols,
          isFirst: !info.hours.has(hour - 1),
          isLast: !info.hours.has(hour + 1),
          color: colorIndexFor(course),
        });
      }
      cell.sort((a, b) => a.col - b.col);
      cells.push(cell);
    }
    rows.push({ hour, cells });
  }

  return { rows, courseOnSaturday, lastHour, maxCols, occupantCount };
}
