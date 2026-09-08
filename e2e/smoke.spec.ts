import { expect, test, type Page } from "@playwright/test";
import {
  PAGE_SIZE,
  appTitle,
  catalogue,
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

test("start-up drops localStorage a removed feature left behind", async ({ page }) => {
  await gotoFresh(page);
  const term = await semesterSelect(page).inputValue();
  await selectCourse(page, SECTION);

  // What a browser that used the version with the roadmap still carries. It is
  // seeded after gotoFresh, so the wipe cannot be what clears it.
  await page.addInitScript(() => {
    localStorage.setItem("roadmap", JSON.stringify({ "2027/2028-1": ["CMPE300"] }));
  });
  await page.reload();
  await waitForCatalogue(page);

  expect(await readStorage(page, "roadmap")).toBeNull();
  // The prune is a named list, not a sweep: everything still in use survives.
  await expect(selectedCourse(page, SECTION)).toBeVisible();
  const stored = await readStorage(page, "semesterSelCourses2");
  expect(JSON.parse(stored as string)).toMatchObject({ [term]: [SECTION] });
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

/**
 * Nothing may float over the catalogue and swallow a row's taps.
 *
 * A `fixed` shortcut button used to sit in the bottom-right corner — the same
 * corner where every row keeps its Add button. Measured on the deployed site it
 * covered 67% of one at 360px and 48% on the desktop, and `elementFromPoint` at
 * the Add button's centre returned the floating button, so the tap never
 * reached the row. Padding and repositioning cannot fix that class of bug: a
 * fixed overlay above a scrolling list collides with whichever row happens to
 * be beneath it, so the assertion is about obstruction, not about geometry.
 */
async function expectRowControlsUnobstructed(page: Page): Promise<void> {
  await catalogue(page).scrollIntoViewIfNeeded();
  // Which row sits under a given screen position depends on the scroll offset,
  // so one position proves very little: the original bug reproduced reliably on
  // the desktop and only sometimes on a phone. Sample a spread of offsets — the
  // window scrolls on a phone, the catalogue's own container on the desktop.
  const obstructed: string[] = [];
  for (const step of [0, 120, 260, 400, 560]) {
    await page.evaluate((offset: number) => {
      window.scrollTo(0, offset);
      const list = document.querySelector('[data-testid="catalogue"]');
      if (list) list.scrollTop = offset;
    }, step);
    obstructed.push(
      ...(await page.evaluate(() => {
        const out: string[] = [];
        const controls = document.querySelectorAll(
          '[data-testid="course-add"],[data-testid="course-remove"],[data-testid="course-details-toggle"]',
        );
        // The catalogue scrolls inside its own box on the desktop, so a row can
        // be out of sight while its rect still falls inside the viewport. A
        // control counts as reachable only where both agree.
        const box = document.querySelector('[data-testid="catalogue"]')?.getBoundingClientRect();
        for (const el of controls) {
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          if (cy < 0 || cy > window.innerHeight) continue;
          if (box && (cy < box.top || cy > box.bottom)) continue;
          const hit = document.elementFromPoint(cx, cy);
          if (!(hit === el || el.contains(hit))) {
            out.push(
              `${(el as HTMLElement).dataset.testid} covered by ${hit?.textContent?.trim().slice(0, 12)}`,
            );
          }
        }
        return out;
      })),
    );
  }
  expect(obstructed, "every visible row control receives its own tap").toEqual([]);
}

test("nothing floats over the catalogue's row controls", async ({ page }) => {
  await gotoFresh(page);
  await expectRowControlsUnobstructed(page);
});

test("nothing floats over the catalogue's row controls @mobile", async ({ page }) => {
  await gotoFresh(page);
  // Narrower than the phone project's default: the row action column and the
  // old overlay only met once the viewport got tight.
  await page.setViewportSize({ width: 360, height: 640 });
  await expectRowControlsUnobstructed(page);
});

/**
 * `.btn-text` is the smallest control in the app at 12px, and the 24px floor
 * used to live in DESIGN.md prose rather than in the class, so callers that
 * forgot it shipped at 18px. The floor is now a property of the class; this
 * checks the rendered result rather than the stylesheet.
 */
test("inline text controls keep a 24px target @mobile", async ({ page }) => {
  await gotoFresh(page);
  const undersized = await page.evaluate(() =>
    [...document.querySelectorAll(".btn-text")]
      .map((el) => ({ label: el.textContent?.trim().slice(0, 20) ?? "", h: el.getBoundingClientRect().height }))
      .filter((c) => c.h > 0 && c.h < 24)
      .map((c) => `${c.label} ${Math.round(c.h)}px`),
  );
  expect(undersized).toEqual([]);
});

test("renders the catalogue on a phone viewport @mobile", async ({ page }) => {
  await gotoFresh(page);

  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  await expect(appTitle(page)).toBeVisible();
  await expect(courseRows(page)).toHaveCount(PAGE_SIZE);
});

/**
 * The filter dialog's Apply button has to be on screen on a phone.
 *
 * It shipped once at y=679 in a 664px-tall viewport — below the fold, outside
 * the dialog's own box, and with nothing to scroll, because the grid's wrapper
 * had no bounded height and so never became a scroller. Filters could be set
 * and never applied. The a11y spec exercises this dialog only on the desktop
 * project, where it fits, which is why nothing caught it; this asserts the
 * height-dependent half.
 *
 * The viewport is shortened to 560px first: `toBeInViewport` is the real
 * check, and it is only meaningful when the content genuinely cannot fit.
 */
test("the filter dialog keeps Apply on screen on a short phone @mobile", async ({
  page,
}) => {
  await gotoFresh(page);
  await page.setViewportSize({ width: 390, height: 560 });

  await page.getByTestId("filters-open").click();
  const apply = page.getByTestId("filters-apply");
  await expect(apply).toBeVisible();
  await expect(apply).toBeInViewport({ ratio: 1 });

  // Nothing overlaps it: a tap at its centre has to reach the button itself.
  const onTarget = await apply.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit === el || el.contains(hit);
  });
  expect(onTarget, "Apply is the topmost element at its own centre").toBe(true);

  // The hours that did not fit are still reachable, i.e. the grid scrolls
  // rather than being clipped away.
  const scrolls = await page
    .locator("dialog[open] .overflow-auto")
    .evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(scrolls, "the hour grid scrolls inside the dialog").toBe(true);

  // And the dialog actually applies rather than merely looking right.
  await page.locator('dialog[open] input[aria-label="Mon 9"]').click();
  await apply.click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});
