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
  waitForCatalogue,
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
 * Every fixed-width <select> must fit its own widest option, in both languages.
 *
 * A native select CLIPS rather than ellipsising, and axe cannot see it: the
 * accessible name comes from aria-label, so the AX tree reads clean while the
 * pixels are cut. The grade picker shipped at w-20 with a 40px text box against
 * a 72px (EN) / 94px (TR) empty option, so every ungraded row — the state the
 * tab opens in — read "Not gr" / "Not gi". This pins the whole class, not the
 * two instances.
 *
 * Measured in the font the browser actually resolved, after document.fonts.ready:
 * the pickers switch between the mono and sans faces, so both states are checked.
 */
for (const lang of ["en", "tr"] as const) {
  test(`no GPA select clips its own options (${lang})`, async ({ page }) => {
    await gotoFresh(page);
    await setLang(page, lang);
    await selectCourse(page, "CMPE150.01");
    await openTab(page, "gpa");

    const measure = async (state: string) => {
      await page.evaluate(() => document.fonts.ready);
      const clipped = await page.evaluate(() => {
        const canvas = document.createElement("canvas").getContext("2d")!;
        const bad: string[] = [];
        for (const el of document.querySelectorAll("#panel-gpa select")) {
          const sel = el as HTMLSelectElement;
          const cs = getComputedStyle(sel);
          const inner =
            sel.getBoundingClientRect().width -
            parseFloat(cs.paddingLeft) -
            parseFloat(cs.paddingRight) -
            parseFloat(cs.borderLeftWidth) -
            parseFloat(cs.borderRightWidth);
          canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          for (const option of sel.options) {
            const width = canvas.measureText(option.text).width;
            if (width > inner) {
              bad.push(
                `${sel.dataset.testid}="${option.text}" needs ${width.toFixed(0)}px, has ${inner.toFixed(0)}px`,
              );
            }
          }
        }
        return bad;
      });
      expect(clipped, `${state}: every option fits its control`).toEqual([]);
    };

    await measure("ungraded");
    // Graded: the grade picker switches to the mono face, which is wider.
    await setGrade(page, "CMPE150.01", "AA");
    await page.getByTestId("gpa-retake").selectOption("FF");
    await measure("graded");
  });
}

/**
 * The credit cell must stay on one line. "3 cr" fits a narrow slot; the Turkish
 * unit is a whole word ("3 kredi") and wrapped every row to double height.
 */
test("the credit cell does not wrap in Turkish", async ({ page }) => {
  await gotoFresh(page);
  await setLang(page, "tr");
  await selectCourse(page, "CMPE150.01");
  await openTab(page, "gpa");
  const box = page.getByTestId("gpa-row-credits").first();
  const height = await box.evaluate((el) => el.getBoundingClientRect().height);
  const lineHeight = await box.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  expect(height, "one line, not two").toBeLessThan(lineHeight * 1.6);
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


/**
 * The solver overwrites the stored selection in place and its history write is
 * a `replace`, so the Undo button is the ONLY route back to the plan the
 * student picked by hand. It used to be component state in CourseList, which
 * the tab switch unmounts — and "solve, then go look at the GPA" is exactly the
 * path a student takes, so the buffer died on the most likely journey.
 */
test("the solver's Undo survives a trip to the GPA tab", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await selectCourse(page, "HTR311.01");
  await page.getByTestId("find-conflict-free").click();
  await expect(page.getByTestId("solver-undo")).toBeVisible();
  const message = await page.getByTestId("solver-message").innerText();

  await openTab(page, "gpa");
  await openTab(page, "planner");

  await expect(page.getByTestId("solver-undo")).toBeVisible();
  expect(await page.getByTestId("solver-message").innerText()).toBe(message);
});

/**
 * Storage the app did not write must not be able to brick the tab.
 *
 * `readGpaEntries` used to validate only the root object, so a term whose value
 * was a string reached `mutateEntry`, which assigns a property to a primitive —
 * a TypeError in module code. It escaped the change handler, so grading died
 * permanently, and the "Clear grades" button never rendered (it needs a
 * recorded grade), leaving no in-app way out.
 *
 * gotoFresh() wipes storage in an init script, so this seeds its own instead.
 */
test("a corrupt gpaEntries value cannot brick the tab", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  // Seeded once, not on every navigation: the reload below has to see what the
  // app persisted, not a fresh copy of the junk.
  await page.addInitScript(() => {
    if (sessionStorage.getItem("__e2e_corrupt_seeded") === "1") return;
    sessionStorage.setItem("__e2e_corrupt_seeded", "1");
    localStorage.setItem("semesterSelCourses2", JSON.stringify({ "2026-2027-1": ["CMPE150.01"] }));
    localStorage.setItem(
      "gpaEntries",
      JSON.stringify({ "2026-2027-1": "pwned", other: [1, 2], third: { "X.01": 7 } }),
    );
    localStorage.setItem("lang", "en");
  });
  await page.goto("./");
  await waitForCatalogue(page);
  await openTab(page, "gpa");

  await setGrade(page, "CMPE150.01", "AA");
  expect(await gpaFigure(page, "term")).toBe("4.00");
  expect(errors, "no uncaught error from the corrupt value").toEqual([]);

  // And it round-trips: the junk was dropped on read, not carried back to disk.
  await page.reload();
  await openTab(page, "gpa");
  await expect(gpaGrade(page, "CMPE150.01")).toHaveValue("AA");
});
