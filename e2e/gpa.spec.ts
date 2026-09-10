import { test, expect } from "@playwright/test";
import {
  gotoFresh,
  openTab,
  gpaRows,
  gpaGrade,
  setGrade,
  gpaFigure,
  selectCourse,
  deselectCourse,
  setLang,
} from "./helpers";

/**
 * The GPA tab is a second view of the plan, not a second app: its input is the
 * selection the planner already holds. These specs pin that coupling, and the
 * one rule the arithmetic must never break — an ungraded term has no GPA, and
 * says so, rather than reporting a 0.00 nobody earned. The arithmetic itself is
 * pinned build-free in tools/lib/test/gpa.test.mjs; this suite is about the
 * wiring.
 *
 * Course keys are hardcoded the way the rest of the suite does it, but the
 * expected GPA is computed from the credits the rows themselves report: the
 * daily scrape can restate a course's credits, and a spec that then fails would
 * be reporting on BOUN, not on this app.
 */

/** Credit-weighted mean, computed independently of the app's own arithmetic. */
function weighted(entries: [number, number][]): string {
  const credits = entries.reduce((sum, [c]) => sum + c, 0);
  const points = entries.reduce((sum, [c, p]) => sum + c * p, 0);
  return (points / credits).toFixed(2);
}

/**
 * Credits the GPA panel reports for one section. Read from its own element:
 * the row's text starts with the section key, whose digits ("CMPE150.01") a
 * looser match happily returns as a credit count.
 */
async function creditsOf(page: import("@playwright/test").Page, key: string) {
  const cell = page
    .getByTestId("gpa-row-credits")
    .and(page.locator(`[data-course=${JSON.stringify(key)}]`));
  const digits = /(\d+)/.exec(await cell.innerText());
  if (!digits) throw new Error(`no credit figure on the ${key} row`);
  return Number(digits[1]);
}

test("the tab shows the sections chosen in the planner", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await selectCourse(page, "HTR311.01");
  await openTab(page, "gpa");
  await expect(gpaRows(page)).toHaveCount(2);
  await expect(gpaGrade(page, "CMPE150.01")).toBeVisible();
  await expect(gpaGrade(page, "HTR311.01")).toBeVisible();
});

test("dropping a course in the planner drops it from the GPA too", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await selectCourse(page, "HTR311.01");
  await openTab(page, "gpa");
  await expect(gpaRows(page)).toHaveCount(2);
  await openTab(page, "planner");
  await deselectCourse(page, "HTR311.01");
  await openTab(page, "gpa");
  await expect(gpaRows(page)).toHaveCount(1);
});

test("an empty plan says so instead of showing a GPA", async ({ page }) => {
  await gotoFresh(page);
  await openTab(page, "gpa");
  await expect(page.getByTestId("gpa-empty")).toBeVisible();
  expect(await gpaFigure(page, "term")).toBe("—");
  expect(await gpaFigure(page, "cumulative")).toBe("—");
});

test("an ungraded course reports no GPA, never a 0.00 nobody earned", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await openTab(page, "gpa");
  await expect(gpaGrade(page, "CMPE150.01")).toHaveValue("");
  expect(await gpaFigure(page, "term")).toBe("—");
  expect(await gpaFigure(page, "credits")).toBe("0");
});

test("the term GPA weights each grade by its credits", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await selectCourse(page, "HTR311.01");
  await openTab(page, "gpa");
  const big = await creditsOf(page, "CMPE150.01");
  const small = await creditsOf(page, "HTR311.01");
  expect(big, "the two courses must differ in credits for this to prove anything").not.toBe(small);
  await setGrade(page, "CMPE150.01", "AA");
  await setGrade(page, "HTR311.01", "CC");
  expect(await gpaFigure(page, "term")).toBe(weighted([[big, 4], [small, 2]]));
  expect(await gpaFigure(page, "credits")).toBe(String(big + small));
});

test("a P earns credits without entering the average", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await selectCourse(page, "HTR311.01");
  await openTab(page, "gpa");
  const graded = await creditsOf(page, "CMPE150.01");
  await setGrade(page, "CMPE150.01", "BB");
  await setGrade(page, "HTR311.01", "P");
  expect(await gpaFigure(page, "term")).toBe("3.00");
  // The passed course's credits are deliberately absent from this figure.
  expect(await gpaFigure(page, "credits")).toBe(String(graded));
});

test("LAB and P.S. sub-rows are not gradeable courses", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await selectCourse(page, "CMPE150.01 LAB 1");
  await openTab(page, "gpa");
  // They carry no credits of their own — their lecture section does.
  await expect(gpaRows(page)).toHaveCount(1);
});

test("a cumulative GPA needs the record, and says so until it has one", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await openTab(page, "gpa");
  await setGrade(page, "CMPE150.01", "AA");
  expect(await gpaFigure(page, "term")).toBe("4.00");
  expect(await gpaFigure(page, "cumulative")).toBe("—");

  const credits = await creditsOf(page, "CMPE150.01");
  await page.getByTestId("gpa-previous").fill("2.00");
  await page.getByTestId("gpa-previous-credits").fill(String(credits));
  // Equal credit on both sides, so the two averages meet in the middle.
  expect(await gpaFigure(page, "cumulative")).toBe("3.00");
});

test("an out-of-range record is refused rather than quietly clamped", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await openTab(page, "gpa");
  await setGrade(page, "CMPE150.01", "AA");
  await page.getByTestId("gpa-previous").fill("7");
  await page.getByTestId("gpa-previous-credits").fill("30");
  await expect(page.getByTestId("gpa-previous")).toHaveAttribute("aria-invalid", "true");
  // Silently treating 7 as 4 would answer a question the student did not ask.
  expect(await gpaFigure(page, "cumulative")).toBe("—");
  expect(await gpaFigure(page, "term")).toBe("4.00");
});

test("a retake withdraws the old attempt from the cumulative record", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await openTab(page, "gpa");
  const credits = await creditsOf(page, "CMPE150.01");
  await setGrade(page, "CMPE150.01", "AA");
  await page.getByTestId("gpa-previous").fill("2.00");
  await page.getByTestId("gpa-previous-credits").fill(String(credits * 2));
  expect(await gpaFigure(page, "cumulative")).toBe(
    weighted([[credits * 2, 2], [credits, 4]]),
  );

  await page.getByTestId("gpa-retake").selectOption("FF");
  // One block of credits leaves the record at 0.0 points, and the new AA
  // replaces it: 2 x 2.00 - 1 x 0.00 over 1 kept block, plus this term's 4.00.
  expect(await gpaFigure(page, "cumulative")).toBe(
    weighted([[credits, 4], [credits, 4]]),
  );
});

test("grades survive a reload", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await openTab(page, "gpa");
  await setGrade(page, "CMPE150.01", "BA");
  await page.getByTestId("gpa-previous").fill("3.00");
  await page.getByTestId("gpa-previous-credits").fill("30");
  const cumulative = await gpaFigure(page, "cumulative");

  await page.reload();
  await openTab(page, "gpa");
  await expect(gpaGrade(page, "CMPE150.01")).toHaveValue("BA");
  expect(await gpaFigure(page, "cumulative")).toBe(cumulative);
});

test("clearing grades leaves the plan itself alone", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await openTab(page, "gpa");
  await setGrade(page, "CMPE150.01", "AA");
  await page.getByTestId("gpa-clear").click();
  await expect(gpaGrade(page, "CMPE150.01")).toHaveValue("");
  await expect(gpaRows(page)).toHaveCount(1);
  expect(await gpaFigure(page, "term")).toBe("—");
});

test("arrow keys move between tabs", async ({ page }) => {
  await gotoFresh(page);
  await page.getByTestId("tab-planner").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("tab-gpa")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("tab-gpa")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("tab-planner")).toHaveAttribute("aria-selected", "true");
});

test("the tab strip and the panel are translated, not hardcoded English", async ({ page }) => {
  await gotoFresh(page);
  await openTab(page, "gpa");
  const englishTab = await page.getByTestId("tab-gpa").innerText();
  const englishPanel = await page.locator("#panel-gpa").innerText();
  await setLang(page, "tr");
  expect(await page.getByTestId("tab-gpa").innerText()).not.toBe(englishTab);
  expect(await page.locator("#panel-gpa").innerText()).not.toBe(englishPanel);
});

/**
 * The GPA row is the densest thing this tab renders — code, name, credits, a
 * grade select, a retake toggle and a second select, all on one line. On a
 * phone that line has to wrap rather than push the page sideways.
 */
test("the GPA panel fits a phone without scrolling sideways @mobile", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await openTab(page, "gpa");
  await setGrade(page, "CMPE150.01", "FF");
  await page.getByTestId("gpa-retake").selectOption("DD");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "no horizontal overflow at 390px").toBeLessThanOrEqual(0);

  // Every control on the row is reachable by tap, not merely present.
  for (const testid of ["gpa-grade", "gpa-retake"]) {
    await expect(page.getByTestId(testid)).toBeInViewport();
  }
});
