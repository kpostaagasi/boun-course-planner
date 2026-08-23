/**
 * Semester discovery.
 *
 * The registration site has no public "list of semesters" endpoint, so we
 * probe candidate term codes derived from the current date. A candidate is
 * "published" when its schedule page echoes back exactly that term code AND
 * returns at least one section for a small, always-active department.
 *
 * Term codes look like "2026/2027-1" (1 = fall, 2 = spring, 3 = summer).
 * Fall schedules typically appear in August; spring in January; summer in
 * June. Probing the previous and current academic years covers every case.
 */

import { fetchSchedule } from "./http.mjs";
import { parseSchedulePage } from "./parse.mjs";

/** Departments used for cheap publication probes (small pages). */
const PROBE_DEPARTMENTS = [
  { kisaadi: "PE", bolum: "PHYSICAL EDUCATION" },
  { kisaadi: "TK", bolum: "TURKISH COURSES COORDINATOR" },
  { kisaadi: "CMPE", bolum: "COMPUTER ENGINEERING" },
];

export function candidateSemesters(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // Academic year starts with the fall term; from July onwards the upcoming
  // year's fall term is the live candidate.
  const academicStart = month >= 7 ? year : year - 1;
  const candidates = [];
  for (const start of [academicStart - 1, academicStart]) {
    for (const term of [1, 2, 3]) {
      candidates.push(`${start}/${start + 1}-${term}`);
    }
  }
  return [...new Set(candidates)];
}

/** The page echoes back the semester it actually served. Unknown codes
 * silently fall back to the latest published term, so verify the echo. */
export function echoedSemester(html) {
  const match = html.match(/Class="bodytextdark">(\d{4}\/\d{4}-\d)<\/td>/i);
  return match ? match[1] : null;
}

async function semesterHasData(donem) {
  for (const dept of PROBE_DEPARTMENTS) {
    const html = await fetchSchedule(donem, dept.kisaadi, dept.bolum);
    if (echoedSemester(html) !== donem) return false;
    if (parseSchedulePage(html).sections.size > 0) return true;
  }
  return false;
}

/**
 * Return all published semester codes among the candidates, oldest first.
 * @param {string[]} extra Additional explicit codes to probe/force.
 */
export async function discoverSemesters(extra = [], now = new Date()) {
  const codes = [...new Set([...candidateSemesters(now), ...extra])];
  const published = [];
  for (const donem of codes) {
    if (await semesterHasData(donem)) {
      published.push(donem);
    } else {
      console.log(`  probe ${donem}: not published`);
    }
  }
  return published;
}

/**
 * Which semester needs syncing: the latest among newly published terms and
 * terms currently inside their teaching window. Exactly one term — archived
 * ones are never re-scraped because the server keeps their pages broken.
 */
export function semestersToSync(published, now = new Date()) {
  if (published.length === 0) return [];
  const sorted = [...published].sort((a, b) => a.localeCompare(b));
  const newest = sorted.at(-1);
  const candidates = published.filter(
    (donem) => donem === newest || isInTeachingWindow(donem, now),
  );
  return [[...candidates].sort((a, b) => a.localeCompare(b)).at(-1)];
}

function isInTeachingWindow(donem, now) {
  const [yearPart, term] = donem.split("-");
  const startYear = Number(yearPart.split("/")[0]);
  // [startMonth, startDay, endMonth, endDay] per term (inclusive windows).
  const windows = {
    1: [9, 1, 1, 31], // fall: Sep .. end of Jan
    2: [2, 1, 6, 30], // spring: Feb .. end of Jun
    3: [6, 15, 9, 30], // summer: mid-Jun .. end of Sep
  };
  const [sm, sd, em, ed] = windows[Number(term)] ?? [0, 0, 0, 0];
  const start = new Date(startYear, sm - 1, sd);
  let end = new Date(now.getFullYear(), em - 1, ed);
  if (em < sm) end = new Date(startYear + 1, em - 1, ed); // window crosses New Year
  return now >= start && now <= end;
}
