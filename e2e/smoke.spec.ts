import { expect, test } from "@playwright/test";
import {
  PAGE_SIZE,
  appTitle,
  courseRows,
  gotoFresh,
  loadCourseRows,
  readStorage,
  searchCourses,
  sectionKeys,
  selectCourse,
  selectedCourse,
  selectedCourses,
  semesterSelect,
  setLang,
  setSemester,
  timetableCell,
  totalCredits,
  waitForCatalogue,
} from "./helpers";

/** A section with a single fixed meeting: Tuesday, slot 8, which the timetable labels hour 16. */
const SECTION = "CMPE150.01";
const SECTION_CREDITS = 3;
const SECTION_DAY_INDEX = 1;
const SECTION_HOUR = 16;

test("loads the shell and the current term's catalogue", async ({ page }) => {
  await gotoFresh(page);

  await expect(page).toHaveTitle("BOUN Course Planner");
  await expect(appTitle(page)).toHaveText("BOUN Course Planner");
  await expect(semesterSelect(page)).toHaveValue(/^\d{4}-\d{4}-\d$/);

  // The catalogue holds thousands of sections but renders 20 at a time, so assert on what
  // pagination actually produces rather than on the dataset size.
  await expect(courseRows(page)).toHaveCount(PAGE_SIZE);
  await loadCourseRows(page, 120);
  await expect.poll(() => courseRows(page).count()).toBeGreaterThan(100);
});

test("narrows the catalogue to sections matching the query", async ({ page }) => {
  await gotoFresh(page);

  await searchCourses(page, "CMPE");
  await expect(courseRows(page)).toHaveCount(PAGE_SIZE);
  const filtered = await sectionKeys(page);
  expect(filtered).toHaveLength(PAGE_SIZE);
  expect(filtered.filter((key) => !key.startsWith("CMPE"))).toEqual([]);

  await searchCourses(page, "");
  expect(await sectionKeys(page)).not.toEqual(filtered);
});

test("adds a section to the panel, the credit total and the timetable", async ({ page }) => {
  await gotoFresh(page);
  expect(await totalCredits(page)).toBe(0);

  await selectCourse(page, SECTION);

  await expect(selectedCourses(page)).toHaveCount(1);
  await expect(selectedCourse(page, SECTION)).toBeVisible();
  expect(await totalCredits(page)).toBe(SECTION_CREDITS);
  await expect(timetableCell(page, SECTION_DAY_INDEX, SECTION_HOUR)).toContainText(SECTION);
});

test("keeps the selection across a reload", async ({ page }) => {
  await gotoFresh(page);
  const term = await semesterSelect(page).inputValue();
  await selectCourse(page, SECTION);

  const stored = await readStorage(page, "semesterSelCourses2");
  expect(stored).not.toBeNull();
  expect(JSON.parse(stored as string)).toMatchObject({ [term]: [SECTION] });

  await page.reload();
  await waitForCatalogue(page);

  await expect(semesterSelect(page)).toHaveValue(term);
  await expect(selectedCourse(page, SECTION)).toBeVisible();
  expect(await totalCredits(page)).toBe(SECTION_CREDITS);
});

test("switches language and remembers it across a reload", async ({ page }) => {
  await gotoFresh(page);
  await expect(appTitle(page)).toHaveText("BOUN Course Planner");

  await setLang(page, "tr");
  await expect(appTitle(page)).toHaveText("BOUN Ders Planlayıcı");
  expect(await readStorage(page, "lang")).toBe("tr");

  await page.reload();
  await waitForCatalogue(page);
  await expect(appTitle(page)).toHaveText("BOUN Ders Planlayıcı");

  await setLang(page, "en");
  await expect(appTitle(page)).toHaveText("BOUN Course Planner");
});

test("loads a different term's catalogue", async ({ page }) => {
  await gotoFresh(page);
  const terms = await semesterSelect(page)
    .locator("option")
    .evaluateAll((options: Element[]) => options.map((o) => (o as HTMLOptionElement).value));
  expect(terms.length).toBeGreaterThan(1);

  await setSemester(page, terms[1]);

  await expect(semesterSelect(page)).toHaveValue(terms[1]);
  await expect(courseRows(page)).toHaveCount(PAGE_SIZE);
});

test("renders the catalogue on a phone viewport @mobile", async ({ page }) => {
  await gotoFresh(page);

  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  await expect(appTitle(page)).toBeVisible();
  await expect(courseRows(page)).toHaveCount(PAGE_SIZE);
});
