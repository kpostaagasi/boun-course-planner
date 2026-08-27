/**
 * Course-card data rows: live quota / enrolment, final-exam clash, instructor
 * click-through.
 *
 * The quota fixtures are read from `public/data/quota.json` at run time rather
 * than hardcoded, because a scrape rewrites that file wholesale: section keys
 * come and go, and a record that is capacity-only today grows `rows` once the
 * registrar publishes enrolment. Both section keys the spec needs — one present
 * in the dataset, one absent from it — are therefore derived by intersecting the
 * quota file with the term file it was scraped for.
 *
 * The exam assertions do NOT use live data. The `Exam` / `Sl.` columns are blank
 * for a whole term until finals are scheduled (0 of 3140 sections carry them
 * today), so the term JSON is intercepted and two sections are given a colliding
 * exam slot. Format used is the one the registrar actually emits: `DD.MM.YYYY`
 * plus a small integer session, e.g. `10.01.2022` / `1`.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  courseRow,
  gotoFresh,
  searchCourses,
  searchInput,
  selectCourse,
  semesterSelect,
  setSemester,
} from "./helpers";

/** The term the app opens on, matching the other specs' pinned fixtures. */
const TERM = "2026-2027-1";

type QuotaRow = { dept?: string; quota?: number; current?: number; note?: string };
type QuotaRecord = { cap?: number | null; rows?: QuotaRow[] };
type QuotaFile = {
  meta?: { term?: string; scrapedAt?: string };
  sections?: Record<string, QuotaRecord>;
};

/**
 * Fetch a data file through the app's own origin, so the spec reads byte-for-byte
 * what the app fetched.
 */
async function readJson<T>(page: Page, file: string): Promise<T> {
  const res = await page.request.get(`data/${file}`);
  expect(res.ok(), `data/${file} must be served`).toBe(true);
  return (await res.json()) as T;
}

/** `2026/2027-1` (the site's spelling) → `2026-2027-1` (ours). */
function normalizeTerm(term: string): string {
  return term.trim().replace(/\//g, "-");
}

test("a section in the quota dataset shows a real occupancy indicator, dated", async ({
  page,
}) => {
  await gotoFresh(page);

  const quota = await readJson<QuotaFile>(page, "quota.json");
  const sections = quota.sections ?? {};
  const quotaKeys = Object.keys(sections);
  expect(quotaKeys.length, "quota.json must carry sections").toBeGreaterThan(0);
  expect(typeof quota.meta?.scrapedAt, "quota.json must be dated").toBe("string");

  // Seat counts are shown only for the term they were scraped for, so make sure
  // that is the term on screen before asserting anything about them.
  const quotaTerm = normalizeTerm(quota.meta?.term ?? "");
  if ((await semesterSelect(page).inputValue()) !== quotaTerm) {
    await setSemester(page, quotaTerm);
  }

  const termData = await readJson<Record<string, unknown>>(page, `${quotaTerm}.json`);
  // Three real states exist in the live file, and they render differently on
  // purpose. Measured on the full 2026/2027-1 sweep (2937 sections): 124 carry
  // departmental rows, but some of those rows are 0/0 placeholders whose only
  // payload is a note such as "Consent Of Instructor" — the card shows the note
  // rather than a meaningless "0/0 seats taken". 1249 publish a capacity with no
  // rows at all. Prefer the richest genuine state and fall back in that order.
  const hasNumericRow = (key: string) =>
    (sections[key].rows ?? []).some(
      (row) => !row.note && typeof row.quota === "number",
    );
  const inTerm = (key: string) => key in termData;
  const present =
    quotaKeys.find((key) => inTerm(key) && hasNumericRow(key)) ??
    quotaKeys.find((key) => inTerm(key) && (sections[key].rows?.length ?? 0) > 0) ??
    quotaKeys.find((key) => inTerm(key) && typeof sections[key].cap === "number");
  expect(present, "quota.json must describe a section of its own term").toBeTruthy();

  await searchCourses(page, present!.split(" ")[0]);
  const state = courseRow(page, present!).getByTestId("course-quota-state");
  await expect(state).toBeVisible();

  // Recompute the expected figures straight from the file, independently of the
  // app's own derivation. Rows are summed, never read at index 0.
  const record = sections[present!];
  const rows = record.rows ?? [];
  const numeric = rows.filter((row) => !row.note && typeof row.quota === "number");
  const note = rows.find((row) => row.note)?.note;
  if (numeric.length > 0) {
    const totalQuota = numeric.reduce((sum, row) => sum + (row.quota ?? 0), 0);
    const totalCurrent = rows.reduce((sum, row) => sum + (row.current ?? 0), 0);
    await expect(state).toContainText(String(totalQuota));
    await expect(state).toContainText(String(totalCurrent));
  } else if (note) {
    // A quota cell carrying only a restriction must surface that restriction,
    // never a fabricated 0-of-0.
    await expect(state).toContainText(note);
    await expect(state).not.toContainText("0/0");
  } else {
    await expect(state).toContainText(String(record.cap));
  }

  // The honesty requirement: a live enrolment figure must carry its own age, so
  // the row always surfaces the scrape clock (HH:MM in any locale).
  await expect(courseRow(page, present!).getByTestId("course-quota")).toContainText(
    /\d{1,2}:\d{2}/,
  );
});

test("a section absent from the quota dataset says unknown, never a fabricated zero", async ({
  page,
}) => {
  await gotoFresh(page);

  const quota = await readJson<QuotaFile>(page, "quota.json");
  const sections = quota.sections ?? {};
  const quotaTerm = normalizeTerm(quota.meta?.term ?? "");
  if ((await semesterSelect(page).inputValue()) !== quotaTerm) {
    await setSemester(page, quotaTerm);
  }

  const termData = await readJson<Record<string, unknown>>(page, `${quotaTerm}.json`);
  // LAB / P.S. sub-rows have no quota page of their own and are skipped by the
  // scraper, so an absent key exists even after a complete run.
  const absent = Object.keys(termData).find((key) => !(key in sections));
  expect(absent, "some section must be outside the quota dataset").toBeTruthy();

  // First token only: the app ORs space-separated tokens, so a `P.S.` sub-row key
  // passed whole would widen the search past the first rendered page.
  await searchCourses(page, absent!.split(" ")[0]);
  const row = courseRow(page, absent!);
  const state = row.getByTestId("course-quota-state");
  await expect(state).toBeVisible();

  // No digit at all in the state: "0", "0/0" and "—" would each read as "no
  // seats left", which is a different claim from "we have no data".
  await expect(state).not.toContainText(/\d/);
});

test("clicking an instructor searches for that instructor", async ({ page }) => {
  await gotoFresh(page);
  await searchCourses(page, "CMPE150.01");

  const row = courseRow(page, "CMPE150.01");
  const instructor = row.getByTestId("course-instructor");
  await expect(instructor).toBeVisible();
  const name = (await instructor.innerText()).trim();

  await instructor.click();
  // The exact scraped string, unmodified: the catalogue's instructor mode keys
  // off an exact-name query.
  await expect(searchInput(page)).toHaveValue(name);
  await expect(courseRow(page, "CMPE150.01")).toBeVisible();
});

test("a final-exam collision between two selected sections is reported on the card", async ({
  page,
}) => {
  // Give two known sections the same exam date AND session; a third gets the
  // same date with no session, which must read as "cannot rule out"; a fourth
  // gets a different date, the only case that licenses a "no clash" claim.
  await page.route(`**/data/${TERM}.json`, async (route) => {
    const response = await route.fetch();
    const data = (await response.json()) as Record<
      string,
      { deliveryMethod?: string; examDate?: string; examSlot?: string; finalExamLocation?: string }
    >;
    data["CMPE101.01"] = { ...data["CMPE101.01"], examDate: "10.01.2022", examSlot: "1" };
    data["CMPE150.01"] = {
      ...data["CMPE150.01"],
      deliveryMethod: "Online/Classroom",
      examDate: "10.01.2022",
      examSlot: "1",
      finalExamLocation: "Classroom",
    };
    data["CMPE250.01"] = { ...data["CMPE250.01"], examDate: "10.01.2022" };
    data["CMPE300.01"] = { ...data["CMPE300.01"], examDate: "12.01.2022", examSlot: "2" };
    await route.fulfill({ response, json: data });
  });

  await gotoFresh(page);
  await selectCourse(page, "CMPE101.01");

  await searchCourses(page, "CMPE150.01");
  const clashing = courseRow(page, "CMPE150.01");
  // Every populated cell is rendered verbatim, and each stays a separate span so
  // the values never run together.
  const examRow = clashing.getByTestId("course-exam");
  await expect(examRow).toContainText("Online/Classroom");
  await expect(examRow).toContainText("Classroom");
  await expect(examRow).toContainText(/10\.01\.2022\s+·\s+\S+\s+1/);
  await expect(clashing.getByTestId("course-exam-clash")).toContainText("CMPE101.01");
  await expect(clashing.getByTestId("course-exam-clear")).toHaveCount(0);

  // Same day, unreadable session: still surfaced, but as the weaker claim.
  await searchCourses(page, "CMPE250.01");
  const undecided = courseRow(page, "CMPE250.01");
  await expect(undecided.getByTestId("course-exam-clash")).toContainText("CMPE101.01");
  await expect(undecided.getByTestId("course-exam-clear")).toHaveCount(0);

  // Different day, both sessions readable: the one case where absence of a clash
  // is actually established rather than merely unobserved.
  await searchCourses(page, "CMPE300.01");
  const clear = courseRow(page, "CMPE300.01");
  await expect(clear.getByTestId("course-exam-clear")).toBeVisible();
  await expect(clear.getByTestId("course-exam-clash")).toHaveCount(0);

  // A section with no exam data at all makes no claim either way.
  await searchCourses(page, "CMPE150.02");
  const silent = courseRow(page, "CMPE150.02");
  await expect(silent).toBeVisible();
  await expect(silent.getByTestId("course-exam")).toHaveCount(0);
  await expect(silent.getByTestId("course-exam-clash")).toHaveCount(0);
  await expect(silent.getByTestId("course-exam-clear")).toHaveCount(0);

  // A "STAFF STAFF" section offers no instructor search: there is nobody to find.
  const placeholder = courseRow(page, "CMPE150.02 LAB 1");
  await expect(placeholder).toContainText("STAFF");
  await expect(placeholder.getByTestId("course-instructor")).toHaveCount(0);
});
