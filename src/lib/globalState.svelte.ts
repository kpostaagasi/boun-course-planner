import { SvelteSet } from "svelte/reactivity";
import {
  buildSelectionSearch,
  decodeHistoryState,
  encodeHistoryState,
  parseSelectionParams,
  resolveInitialSelection,
  sameCourses,
  stripSelectionSearch,
  type UrlSelection,
} from "./urlState";

let currentSemester = $state(""); // Currently selected semester

export function getCurrentSemester() {
  return currentSemester;
}

export function setCurrentSemester(value: string) {
  if (!semesterBootstrapped && value) {
    // First term the app actually knows about (SemesterSelect resolves it from
    // data/semesters.json). Deferred share params are consumed here.
    semesterBootstrapped = true;
    bootstrapFromUrl(value);
    return;
  }
  if (currentSemester === value) return;
  currentSemester = value;
  writeHistory("replace");
}

let semesterData: Record<string, any> = $state({}); // Stores the course data for each downloaded semester

export function getSemesterData() {
  return semesterData;
}

export function setSemesterDataForSemester(semester: string, data: object) {
  semesterData[semester] = data;
}

let searchQuery = $state(""); // Search query for filtering courses by name or instructor

export function getSearchQuery() {
  return searchQuery;
}

export function setSearchQuery(value: string) {
  searchQuery = value;
}

let hoveredCourse = $state(""); // Course currently hovered by mouse

export function getHoveredCourse() {
  return hoveredCourse;
}

export function setHoveredCourse(value: string) {
  // Do not highlight the hovered course on mobile because touch is registed as mouseenter
  // and the course remains still highlighted when user no longer touches
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) {
    hoveredCourse = value;
  }
}

export function resetHoveredCourse() {
  hoveredCourse = "";
}

let selectedCourseNamesAll = $state(readSelectedCourseNames()); // selected course names for all semesters

// ---- URL <-> selection sync (pure logic lives in ./urlState.mjs) ----
//
// Share params are parsed at module load but deliberately NOT applied here.
// A link may carry `?c=` without `?d=`, and at module-init no semester exists
// yet — SemesterSelect calls setCurrentSemester() only after fetching
// data/semesters.json. Reading the `currentSemester` rune from module scope
// would capture "" forever (the `state_referenced_locally` compiler warning),
// which silently dropped the whole selection of every `?c=`-only share link.
let pendingShareParams: UrlSelection | null = parseSelectionParams(
  location.search
);
let semesterBootstrapped = false;
let restoringHistory = false;

// Consume the share params once a real term is known. A snapshot of the
// resulting selection always goes into history.state, so Back from the first
// edit returns here even when the address bar has been cleaned.
function bootstrapFromUrl(defaultSemester: string) {
  const share = pendingShareParams;
  pendingShareParams = null;
  const resolved = resolveInitialSelection(
    selectedCourseNamesAll,
    share,
    defaultSemester
  );
  currentSemester = resolved.semester;
  if (resolved.changed) {
    selectedCourseNamesAll = resolved.selection;
    persistSelectedCourseNames();
  }
  // Scrub `?d=`/`?c=` once consumed, so a later reload cannot resurrect a stale
  // shared selection over the user's own subsequent edits. Only a link that
  // actually carried a selection is scrubbed: a bare `?d=` is this module's own
  // output (see writeHistory), and leaving it alone is what makes the chosen
  // term survive every reload rather than just the first one.
  const carriedSelection = (share?.courses.length ?? 0) > 0;
  writeHistory(
    "replace",
    carriedSelection ? stripSelectionSearch(location.search) : location.search
  );
}

// History granularity, decided deliberately:
//   push  - adding or removing a single course. Each is a discrete, intentional
//           edit, so Back works as undo, which is genuinely useful in a
//           planner. A session produces tens of these, not thousands: nothing
//           keystroke-level ever reaches the URL (typing in the search box does
//           not touch it).
//   replace - everything else: switching term, the availability filtering that
//           runs when a semester's data lands, and the solver applying a
//           schedule. Back stays reserved for undoing hand-made edits.
//
// `search` is passed only by the bootstrap, which must always write in order to
// seed history.state (and, for a share link, to scrub the params). Every other
// call is a no-op when the current entry already describes this exact state, so
// the availability pass that runs right after bootstrap does not immediately
// put `?d=`/`?c=` back.
function writeHistory(mode: "push" | "replace", search?: string) {
  if (restoringHistory) return;
  const semester = currentSemester;
  const courses = selectedCourseNamesAll[semester] ?? [];
  if (search === undefined) {
    const current = decodeHistoryState(history.state, location.search);
    if (current.semester === semester && sameCourses(current.courses, courses)) {
      return;
    }
  }
  const query =
    search ?? buildSelectionSearch(location.search, semester, courses);
  const url = `${location.pathname}${query}${location.hash}`;
  const entry = encodeHistoryState(semester, courses);
  if (mode === "push") {
    history.pushState(entry, "", url);
  } else {
    history.replaceState(entry, "", url);
  }
}

function applyHistoryEntry(selection: UrlSelection) {
  restoringHistory = true;
  try {
    if (selection.semester && selection.semester !== currentSemester) {
      currentSemester = selection.semester;
    }
    const semester = currentSemester;
    if (!semester) return;
    if (sameCourses(selectedCourseNamesAll[semester], selection.courses)) {
      return;
    }
    selectedCourseNamesAll[semester] = [...selection.courses];
    persistSelectedCourseNames();
  } finally {
    restoringHistory = false;
  }
}

// Wire Back/Forward to the selection. Called from App.svelte's onMount so the
// listener has an owner and a cleanup path; returns the unsubscriber.
export function initUrlSync(): () => void {
  const onPopState = (event: PopStateEvent) => {
    applyHistoryEntry(decodeHistoryState(event.state, location.search));
  };
  window.addEventListener("popstate", onPopState);
  return () => window.removeEventListener("popstate", onPopState);
}

export function getSelectedCourseNamesAll() {
  return selectedCourseNamesAll;
}

export function addCourse(newCour: string) {
  if (!(currentSemester in selectedCourseNamesAll)) {
    selectedCourseNamesAll[currentSemester] = [];
  }
  selectedCourseNamesAll[currentSemester].push(newCour);
  selectedCourseNamesAll[currentSemester].sort();
  persistSelectedCourseNames();
  writeHistory("push");
}

export function delCourse(delCour: string) {
  if (!(currentSemester in selectedCourseNamesAll)) {
    selectedCourseNamesAll[currentSemester] = [];
  }
  const indexArr = selectedCourseNamesAll[currentSemester].indexOf(delCour);
  selectedCourseNamesAll[currentSemester].splice(indexArr, 1);
  selectedCourseNamesAll[currentSemester].sort();
  persistSelectedCourseNames();
  writeHistory("push");
}

export function setCourseList(courseList: string[]) {
  selectedCourseNamesAll[currentSemester] = courseList;
  persistSelectedCourseNames();
  writeHistory("replace");
}

function readSelectedCourseNames() {
  let selectedCoursesForSemesters = localStorage.getItem("semesterSelCourses2");
  if (!selectedCoursesForSemesters) {
    return {};
  }

  let parsedSelectedCoursesForSemesters;
  try {
    parsedSelectedCoursesForSemesters = JSON.parse(selectedCoursesForSemesters);
  } catch (error) {
    parsedSelectedCoursesForSemesters = {};
    // Reset storage if corrupted
    localStorage.setItem("semesterSelCourses2", "{}");
  }

  if (
    typeof parsedSelectedCoursesForSemesters !== "object" ||
    parsedSelectedCoursesForSemesters === null
  ) {
    parsedSelectedCoursesForSemesters = {};
  }
  return parsedSelectedCoursesForSemesters;
}

function persistSelectedCourseNames() {
  localStorage.setItem(
    "semesterSelCourses2",
    JSON.stringify(selectedCourseNamesAll)
  );
}

let selectedDayHourFilter: boolean[][] = $state(initSelectedDayHourFilter());

function initSelectedDayHourFilter(): boolean[][] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array.from({ length: 14 }, (_, i) => i + 9); // 9..22 inclusive

  // selection state: rows = days, cols = hours
  return days.map(() => new Array(hours.length).fill(true));
}

export function getSelectedDayHourFilter() {
  return selectedDayHourFilter;
}

export function setSelectedDayHourFilter(value: boolean[][]) {
  selectedDayHourFilter = value;
}

let showCoursesWithoutSchedule = $state(true); // Whether to show courses without schedule info

export function getShowCoursesWithoutSchedule() {
  return showCoursesWithoutSchedule;
}

export function setShowCoursesWithoutSchedule(value: boolean) {
  showCoursesWithoutSchedule = value;
}

const isDayHourFilterApplied = $derived.by(() => {
  return selectedDayHourFilter.some((day) => day.some((val) => !val));
});

export function getIsDayHourFilterApplied() {
  return isDayHourFilterApplied;
}

const searchedCourseNames: string[] = $derived.by(() => {
  if (!currentSemester || !semesterData[currentSemester]) {
    return [];
  }

  const data = semesterData[currentSemester];
  const allCourseEntries = Object.entries(data);

  if (allCourseEntries.length === 0) {
    return [];
  }

  // Perform search filtering
  const regexString = searchQuery
    .trim()
    .split(" ")
    .filter((str) => str.length >= 2)
    .join("|");

  let searchedCourses: [string, any][];

  if (regexString) {
    const regex = new RegExp(regexString, "i");

    // First, try searching by the course code (the object key)
    searchedCourses = allCourseEntries.filter(([courseName, _]) =>
      regex.test(courseName)
    );

    // If no results, fall back to full name, instructor and catalog description
    if (searchedCourses.length === 0) {
      searchedCourses = allCourseEntries.filter(
        ([_, courseInfo]: [string, any]) =>
          regex.test(courseInfo.name) || regex.test(courseInfo.instructor)
      );
      // Last resort: the catalog description text ("CMPE150.01" -> "CMPE150").
      // descriptions.json is ~244 KB gzipped, so it is NOT part of the initial
      // payload; it is pulled in only once a query has already defeated both
      // cheap branches. Reading `descriptionData` registers the dependency, so
      // this derived re-runs and the results appear when the fetch lands.
      const descriptions = descriptionData;
      if (searchedCourses.length === 0) {
        ensureDescriptions();
      }
      if (searchedCourses.length === 0 && descriptions) {
        searchedCourses = allCourseEntries.filter(([courseName, _]: [string, any]) => {
          const baseCode = courseName.split(".")[0].replace(/\s+/g, "");
          const desc = descriptions[baseCode];
          return desc ? regex.test(desc.description) || regex.test(desc.title) : false;
        });
      }
    }
  } else {
    // If no search query, all courses are included
    searchedCourses = allCourseEntries;
  }

  // Apply day/hour filter on the *already filtered* search results
  const finalFilteredCourses = isDayHourFilterApplied
    ? searchedCourses.filter(([_, courseInfo]) => {
        if (!courseInfo.days || !courseInfo.hours) {
          return showCoursesWithoutSchedule;
        }

        // Use .every() to ensure ALL of the course's time slots fit the filter.
        return courseInfo.days.every((day: string, i: number) => {
          const hour = courseInfo.hours[i];
          const dayIdx = ["M", "T", "W", "Th", "F", "St"].indexOf(day);
          const hourIdx = hour - 1;

          // Ensure indices are valid before checking the filter array
          if (dayIdx === -1 || hourIdx < 0) return false;

          return selectedDayHourFilter[dayIdx][hourIdx];
        });
      })
    : searchedCourses; // If filter is off, just use the search results

  // Return only the course names (the keys)
  return finalFilteredCourses.map(([courseName, _]) => courseName);
});

export function getSearchedCourseNames() {
  return searchedCourseNames;
}

// Only the course data for currently selected semester
const curSemesterData = $derived.by(() => {
  return semesterData[currentSemester] || null;
});

export function getCurSemesterData() {
  return curSemesterData;
}

const selectedCourseNames: string[] = $derived.by(() => {
  return selectedCourseNamesAll[currentSemester] || [];
});

export function getSelectedCourseNames() {
  return selectedCourseNames;
}

const curSemCategories = $derived.by(() => {
  if (!curSemesterData) {
    return [];
  }
  const cat: Set<string> = new Set();
  for (const [courseName, courseInfo] of Object.entries(curSemesterData)) {
    // Get course category by matching the longest letter sequence
    const re = /[$A-Za-z]+/g;
    const matchArray = courseName.match(re);
    if (matchArray && matchArray.length > 0) {
      cat.add(matchArray[0]);
    }
  }
  return Array.from(cat);
});

export function getCurSemCategories() {
  return curSemCategories;
}

export type PrereqInfo = {
  prereqs: string[];
  coreqs: string[];
  consent: boolean;
  gpa: string | null;
};

let prereqData = $state<Record<string, PrereqInfo> | null>(null); // Prerequisite data keyed by course code ("CMPE150")
let prereqLoadStarted = false;

// Fetch prerequisite data once; missing/404/error leaves prereqData null
export async function loadPrereqs(): Promise<void> {
  if (prereqLoadStarted) return;
  prereqLoadStarted = true;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/prereqs.json`);
    if (res.ok) {
      prereqData = (await res.json()) as Record<string, PrereqInfo>;
    }
  } catch {
    // Data unavailable; app works without prerequisites
  }
}

export function getPrereqsFor(code: string): PrereqInfo | null {
  return prereqData ? (prereqData[code] ?? null) : null;
}

export function getPrereqsAll(): Record<string, PrereqInfo> | null {
  return prereqData;
}

let offeringsData = $state<Record<string, string[]> | null>(null); // Offering terms keyed by base course code ("CMPE210")
let offeringsLoadStarted = false;

// Fetch offering history data once; missing/404/error leaves offeringsData null
export async function loadOfferings(): Promise<void> {
  if (offeringsLoadStarted) return;
  offeringsLoadStarted = true;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/offerings.json`);
    if (res.ok) {
      offeringsData = (await res.json()) as Record<string, string[]>;
    }
  } catch {
    // Data unavailable; app works without offering badges
  }
}

export function getOfferings(): Record<string, string[]> | null {
  return offeringsData;
}

export type DescriptionInfo = {
  title: string;
  credits: string;
  ects: string;
  description: string;
  prerequisite: string | null;
};

let descriptionData = $state<Record<string, DescriptionInfo> | null>(null); // Catalog descriptions keyed by course code ("CMPE150")
let descriptionLoad: Promise<void> | null = null;

// Fetch catalog course descriptions on demand; missing/404/error leaves
// descriptionData null. NOT part of the initial payload: data/descriptions.json
// is ~244 KB gzipped and only two things need it — expanding a course card's
// description, and the last-resort branch of the catalogue search. Callers get
// the same in-flight promise, so awaiting it always means "the data is here".
export function ensureDescriptions(): Promise<void> {
  descriptionLoad ??= (async () => {
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}data/descriptions.json`
      );
      if (res.ok) {
        descriptionData = (await res.json()) as Record<string, DescriptionInfo>;
      }
    } catch {
      // Data unavailable; app works without descriptions
    }
  })();
  return descriptionLoad;
}

export function getDescriptionFor(code: string): DescriptionInfo | null {
  return descriptionData ? (descriptionData[code] ?? null) : null;
}

// ---- Completed courses (eligibility feature) ----
const completedCourses = new SvelteSet<string>();
let completedLoaded = false;

export function loadCompleted(): void {
  if (completedLoaded) return;
  completedLoaded = true;
  try {
    const raw = localStorage.getItem("completedCourses");
    if (raw) {
      const arr: string[] = JSON.parse(raw);
      for (const code of arr) completedCourses.add(code);
    }
  } catch {
    // private mode / corrupt data: start empty
  }
}

export function toggleCompleted(code: string): void {
  if (completedCourses.has(code)) {
    completedCourses.delete(code);
  } else {
    completedCourses.add(code);
  }
  try {
    localStorage.setItem("completedCourses", JSON.stringify([...completedCourses]));
  } catch {
    // ignore persistence failures
  }
}

export function isCompleted(code: string): boolean {
  return completedCourses.has(code);
}

export function getCompletedCourses(): string[] {
  return [...completedCourses];
}

// ---- Roadmap (multi-semester planning) ----
const roadmapState = $state<Record<string, string[]>>({});
let roadmapLoaded = false;

function persistRoadmap(): void {
  try {
    localStorage.setItem("roadmap", JSON.stringify(roadmapState));
  } catch {
    // ignore
  }
}

export function loadRoadmap(): void {
  if (roadmapLoaded) return;
  roadmapLoaded = true;
  try {
    const raw = localStorage.getItem("roadmap");
    if (raw) {
      const parsed: Record<string, string[]> = JSON.parse(raw);
      for (const [term, codes] of Object.entries(parsed)) {
        roadmapState[term] = codes;
      }
    }
  } catch {
    // corrupt data: start empty
  }
}

export function getRoadmap(): Record<string, string[]> {
  return roadmapState;
}

export function addToRoadmap(semester: string, code: string): void {
  if (!roadmapState[semester]) roadmapState[semester] = [];
  if (!roadmapState[semester].includes(code)) {
    roadmapState[semester].push(code);
    persistRoadmap();
  }
}

export function removeFromRoadmap(semester: string, code: string): void {
  const list = roadmapState[semester];
  if (list) {
    const idx = list.indexOf(code);
    if (idx !== -1) {
      list.splice(idx, 1);
      persistRoadmap();
    }
  }
}

export function clearRoadmap(): void {
  for (const k of Object.keys(roadmapState)) delete roadmapState[k];
  persistRoadmap();
}
