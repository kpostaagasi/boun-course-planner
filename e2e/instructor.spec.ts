/**
 * Instructor-centric view: turning the free-text `instructor` cell into
 * something you can filter and read.
 *
 * Every instructor used here is derived from the term file the app itself just
 * loaded, never hardcoded — the catalogue is re-scraped weekly and any name
 * written into this spec would rot. What is asserted is the *relationship*
 * between the picked person and the rendered rows, which survives a refresh.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  PAGE_SIZE,
  courseRows,
  gotoFresh,
  searchCourses,
  searchInput,
  sectionKeys,
  semesterSelect,
} from "./helpers";

/** Mirrors `HISTORY_COURSE_LIMIT` in `src/lib/InstructorPanel.svelte`. */
const HISTORY_COURSE_LIMIT = 8;

type Candidate = {
  /** the exact scraped spelling, as the card and the panel render it */
  instructor: string;
  /** every section key of that person this term, in catalogue order */
  sectionKeys: string[];
  /** a section of theirs that has a day and an hour */
  scheduledKey: string;
};

/**
 * Pick a real instructor out of the currently selected term's JSON.
 *
 * Constraints, all deliberate:
 * - never a placeholder cell (`STAFF STAFF` is 82 sections of this term and is
 *   not a person),
 * - between 2 and PAGE_SIZE-1 sections, so instructor mode is a visible
 *   narrowing *and* the whole set fits on the first pagination page,
 * - at least one section with a day and an hour, so the panel has a schedule
 *   to render.
 */
async function pickInstructor(page: Page): Promise<Candidate> {
  const term = await semesterSelect(page).inputValue();
  expect(term).toMatch(/^\d{4}-\d{4}-\d$/);

  const candidate = await page.evaluate(
    async ({ termKey, maxSections }) => {
      const res = await fetch(
        new URL(`data/${termKey}.json`, document.baseURI).toString(),
      );
      const data: Record<
        string,
        { instructor?: string; days?: string[]; hours?: number[] }
      > = await res.json();

      // Mirror of the app's placeholder vocabulary, kept deliberately separate:
      // a test that imported the app's own predicate could not catch it
      // regressing.
      const PLACEHOLDER: Record<string, true> = {
        STAFF: true,
        TBA: true,
        TBD: true,
        NA: true,
        "-": true,
        "?": true,
      };

      const sectionsByName = new Map<string, string[]>();
      const scheduledByName = new Map<string, string>();
      for (const [sectionKey, info] of Object.entries(data)) {
        const name = String(info?.instructor ?? "");
        const tokens = name.trim().split(/\s+/).filter(Boolean);
        const isPlaceholder =
          tokens.length === 0 ||
          tokens.every(
            (token) =>
              PLACEHOLDER[
                token
                  .normalize("NFD")
                  .replace(/\p{M}+/gu, "")
                  .toUpperCase()
              ] === true,
          );
        if (isPlaceholder) continue;

        const keys = sectionsByName.get(name);
        if (keys) keys.push(sectionKey);
        else sectionsByName.set(name, [sectionKey]);

        if (
          !scheduledByName.has(name) &&
          Array.isArray(info?.days) &&
          info.days.length > 0 &&
          Array.isArray(info?.hours) &&
          info.hours.length > 0
        ) {
          scheduledByName.set(name, sectionKey);
        }
      }

      const usable = [...sectionsByName.entries()]
        .filter(
          ([name, keys]) =>
            keys.length >= 2 &&
            // Strictly below the page size: narrowing must be observable
            // against the PAGE_SIZE rows the fresh catalogue shows.
            keys.length < maxSections &&
            scheduledByName.has(name),
        )
        // Most sections first: the widest narrowing this term allows.
        .sort((a, b) => b[1].length - a[1].length);
      if (usable.length === 0) return null;
      const [instructor, keys] = usable[0];
      return {
        instructor,
        sectionKeys: keys,
        scheduledKey: scheduledByName.get(instructor) as string,
      };
    },
    { termKey: term, maxSections: PAGE_SIZE },
  );

  expect(candidate, `no usable instructor in ${term}`).not.toBeNull();
  return candidate as Candidate;
}

test("an exact instructor name narrows the catalogue to that person's sections", async ({
  page,
}) => {
  await gotoFresh(page);
  const person = await pickInstructor(page);
  const before = await courseRows(page).count();

  await searchCourses(page, person.instructor);

  // Exactly their sections, in catalogue order — not the superset the fuzzy
  // search chain returns for a name whose tokens also match other people.
  expect(await sectionKeys(page)).toEqual(person.sectionKeys);
  expect(person.sectionKeys.length).toBeLessThan(before);

  // Every visible row really is taught by them. `innerText` collapses
  // whitespace runs and scraped names contain double spaces ("ADNAN  JAFAR"),
  // so both sides are flattened.
  const rendered = await courseRows(page).evaluateAll((rows: Element[]) =>
    rows.map((row) => (row as HTMLElement).innerText),
  );
  expect(rendered.length).toBe(person.sectionKeys.length);
  for (const text of rendered) {
    expect(text.replace(/\s+/g, " ")).toContain(
      person.instructor.replace(/\s+/g, " "),
    );
  }
});

test("a partial name offers instructor chips that activate the filter", async ({
  page,
}) => {
  await gotoFresh(page);
  const person = await pickInstructor(page);

  // One character short of the full name: enough to identify them, not enough
  // to be an exact match, so the suggestion strip is what answers.
  await searchCourses(page, person.instructor.slice(0, -1));

  const chip = page
    .getByTestId("instructor-chip")
    .filter({ hasText: person.instructor })
    .first();
  await expect(chip).toBeVisible();
  await chip.click();

  await expect(searchInput(page)).toHaveValue(person.instructor);
  await expect(page.getByTestId("instructor-matches")).toHaveCount(0);
  await expect(page.getByTestId("instructor-name")).toHaveText(
    person.instructor,
  );
  await expect.poll(() => sectionKeys(page)).toEqual(person.sectionKeys);
});

test("the instructor panel lists this term's sections with a day and time", async ({
  page,
}) => {
  await gotoFresh(page);
  const person = await pickInstructor(page);
  await searchCourses(page, person.instructor);

  const panel = page.getByTestId("instructor-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("instructor-name")).toHaveText(
    person.instructor,
  );

  const sections = panel.getByTestId("instructor-section");
  await expect(sections).toHaveCount(person.sectionKeys.length);

  // The section known to have a meeting renders a weekday and a clock hour.
  // Matched with a whitespace-tolerant pattern because Playwright normalises
  // the rendered text but not the expected string, and keys like "AD  211.01"
  // carry the registrar's double space.
  const keyPattern = new RegExp(
    person.scheduledKey
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+"),
  );
  const scheduled = sections.filter({ hasText: keyPattern }).first();
  await expect(scheduled.getByTestId("instructor-schedule")).toHaveText(
    /(Mon|Tue|Wed|Thu|Fri|Sat|Pzt|Sal|Çar|Per|Cum|Cmt)\s\d{2}:00/,
  );

  // Teaching history: ranked by how persistent a course is, capped at
  // HISTORY_COURSE_LIMIT rows with the tail summarised, and scoped to the
  // terms the panel actually loaded. Asserted on course codes so it holds in
  // either language.
  const history = panel.getByTestId("instructor-history");
  await expect(history).toBeVisible();
  const currentCodes = [
    ...new Set(
      person.sectionKeys.map((key) => key.split(".")[0].replace(/\s+/g, "")),
    ),
  ];
  const historyRows = panel.getByTestId("instructor-history-course");
  // Everything they teach this term is inside the window, so the head is at
  // least that long — or exactly the cap, when the window holds more.
  await expect
    .poll(() => historyRows.count())
    .toBeGreaterThanOrEqual(Math.min(HISTORY_COURSE_LIMIT, currentCodes.length));
  // First whitespace-separated token of a row is its course code, whether the
  // flex layout made `innerText` break the spans onto separate lines or not.
  const shown = await historyRows.evaluateAll((rows: Element[]) =>
    rows.map((row) => (row as HTMLElement).innerText.trim().split(/\s+/)[0]),
  );
  expect(shown.length).toBeLessThanOrEqual(HISTORY_COURSE_LIMIT);
  for (const code of shown) {
    expect(code).toMatch(/^[A-Z]{2,7}\d{2,3}[A-Z]?$/);
  }
  // Nothing was hidden, so every course they teach this term must be listed.
  if (shown.length < HISTORY_COURSE_LIMIT) {
    expect(shown.sort()).toEqual(expect.arrayContaining(currentCodes.sort()));
  }
});

test("placeholder instructors are never offered as people", async ({ page }) => {
  await gotoFresh(page);

  // `STAFF STAFF` staffs 82 sections of the current term, so the catalogue
  // still has hits to show — but nothing may present it as a person.
  for (const query of ["STAFF", "STAFF STAFF", "TBA"]) {
    await searchCourses(page, query);
    await expect(page.getByTestId("instructor-chip")).toHaveCount(0);
    await expect(page.getByTestId("instructor-panel")).toHaveCount(0);
  }
});

test("clearing instructor mode restores the catalogue", async ({ page }) => {
  await gotoFresh(page);
  const person = await pickInstructor(page);
  await searchCourses(page, person.instructor);
  await expect(page.getByTestId("instructor-panel")).toBeVisible();

  await page.getByTestId("instructor-clear").click();

  await expect(searchInput(page)).toHaveValue("");
  await expect(page.getByTestId("instructor-panel")).toHaveCount(0);
  await expect.poll(() => courseRows(page).count()).toBe(PAGE_SIZE);
});
