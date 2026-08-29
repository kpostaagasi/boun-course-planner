/**
 * Shared Playwright helpers for the BOUN Course Planner e2e suite.
 *
 * The app ships no `data-testid` attributes, so every locator below is derived from a stable
 * structural fact about the rendered DOM rather than from styling or copy. Import from here instead
 * of re-deriving selectors in a spec: when the markup moves, this file is the only place to fix.
 *
 * Structural facts these helpers rely on:
 * - The right-hand catalogue and the left "Courses" panel both use `[role=list]` /
 *   `[role=listitem]`. They are told apart by the syllabus/report links that only catalogue rows
 *   carry, so the helpers never depend on which pane comes first in the DOM.
 * - A catalogue row's first `<span>` is its section key, e.g. `CMPE150.01` or `CMPE150.01 LAB 1`.
 * - The catalogue paginates 20 rows at a time via an IntersectionObserver sentinel, and every
 *   keystroke in the search box resets it to page 1.
 * - The timetable is the first `<table>` in the document. Its header row starts with an hour
 *   gutter cell followed by six day columns in fixed order Mon..Sat; the Sat column keeps its slot
 *   in the DOM and is merely given a `hidden` class when nothing is scheduled on Saturday.
 *   Day labels are translated, so nothing here matches on day text.
 * - Body rows start at hour 9 and stop after the latest scheduled hour (never earlier than 16).
 */
import { expect, type Locator, type Page } from "@playwright/test";

/** Every `localStorage` key the app reads at start-up. `gotoFresh` wipes exactly these. */
export const STORAGE_KEYS = [
  "semesterSelCourses2",
  "completedCourses",
  "roadmap",
  "lang",
] as const;

/** Rows the catalogue renders per pagination step (`pageSize` in `CourseCatalogue.svelte`). */
export const PAGE_SIZE = 20;

/** Hour label of the first timetable body row. */
export const FIRST_HOUR = 9;

/** `sessionStorage` marker so `gotoFresh` wipes storage once per context, not on every reload. */
const CLEARED_MARKER = "__e2e_storage_cleared";

/**
 * Navigate to the app with a guaranteed-clean slate and wait until the catalogue has rendered.
 *
 * `globalState.svelte.ts` reads `localStorage` and the `?d=`/`?c=` share params at *module load*
 * time, so the wipe is installed as an init script and runs before any app code — clearing after
 * the load would be too late. The wipe is marked in `sessionStorage`, so a later `page.reload()`
 * keeps whatever the app persisted and persistence specs work as expected.
 *
 * `path` is resolved against the project `baseURL`; pass a query string to exercise share links,
 * e.g. `gotoFresh(page, './?d=2026-2027-1&c=CMPE150.01')`. If a spec needs *pre-seeded* storage
 * (URL-vs-storage precedence, a pre-populated roadmap), do not use this helper: register your own
 * `page.addInitScript` and call `page.goto` directly.
 */
export async function gotoFresh(page: Page, path = "./"): Promise<void> {
  await page.addInitScript(
    ({ keys, marker }: { keys: readonly string[]; marker: string }) => {
      try {
        if (sessionStorage.getItem(marker) === "1") {
          return;
        }
        sessionStorage.setItem(marker, "1");
        for (const key of keys) {
          localStorage.removeItem(key);
        }
      } catch {
        // Storage unavailable; the app tolerates it and so do we.
      }
    },
    { keys: STORAGE_KEYS, marker: CLEARED_MARKER },
  );
  await page.goto(path);
  await waitForCatalogue(page);
}

/** Wait until the course catalogue has data on screen. */
export async function waitForCatalogue(page: Page): Promise<void> {
  await expect(courseRows(page).first()).toBeVisible();
}

/**
 * The catalogue `[role=list]` in the right pane, identified by the links only its rows carry.
 * Resolves to nothing while the catalogue is empty (between semesters, or for a search with no
 * hits), which is why callers poll counts rather than asserting on the container itself.
 */
export function catalogue(page: Page): Locator {
  return page
    .locator('[role="list"]')
    .filter({ has: page.locator('[role="listitem"] a[href]') });
}

/** Every catalogue row currently rendered. `.count()` is what the user can actually scroll to. */
export function courseRows(page: Page): Locator {
  return catalogue(page).locator("> [role=listitem]");
}

/** One catalogue row, matched on the section key in its first `<span>` (e.g. `CMPE150.01`). */
export function courseRow(page: Page, sectionKey: string): Locator {
  return courseRows(page).filter({
    has: page.locator(`span:text-is(${JSON.stringify(sectionKey)})`),
  });
}

/** Section keys of the rows currently rendered in the catalogue, in DOM order. */
export function sectionKeys(page: Page): Promise<string[]> {
  return courseRows(page).evaluateAll((rows: Element[]) =>
    rows.map((row) => (row.querySelector("span")?.textContent ?? "").trim()),
  );
}

/** The green add (+) button of a catalogue row; absent once the section is selected. */
export function addButton(row: Locator): Locator {
  return row.locator("button.bg-green-100");
}

/** The red remove (−) button of a catalogue row; present only once the section is selected. */
export function removeButton(row: Locator): Locator {
  return row.locator("button.bg-red-100");
}

/**
 * Add a section to the selection and wait until it shows up in the left "Courses" panel.
 *
 * Searches for the section first when it is not among the rendered rows, then restores the
 * previous search query, so the helper leaves the catalogue as it found it. No-op when the section
 * is already selected.
 */
export async function selectCourse(page: Page, sectionKey: string): Promise<void> {
  if ((await selectedCourse(page, sectionKey).count()) > 0) {
    return;
  }
  const previousQuery = await searchInput(page).inputValue();
  let searched = false;
  if ((await courseRow(page, sectionKey).count()) === 0) {
    // The first token alone: the app ORs the space-separated tokens together, so passing
    // "CMPE150.01 LAB 1" would widen the search to every LAB section in the term.
    await searchCourses(page, sectionKey.split(" ")[0]);
    searched = true;
    await expect(courseRow(page, sectionKey)).toHaveCount(1);
  }
  await addButton(courseRow(page, sectionKey)).click();
  await expect(selectedCourse(page, sectionKey)).toHaveCount(1);
  if (searched) {
    await searchCourses(page, previousQuery);
  }
}

/** Remove a section from the selection via the × button in the left "Courses" panel. */
export async function deselectCourse(page: Page, sectionKey: string): Promise<void> {
  await selectedCourse(page, sectionKey).locator("button").click();
  await expect(selectedCourse(page, sectionKey)).toHaveCount(0);
}

/** The left "Courses" panel: header, selected sections, credit total, export actions. */
export function coursesPanel(page: Page): Locator {
  return page.locator('[role="region"]');
}

/**
 * Every row in the left "Courses" panel; `.count()` is the selected-section count. Resolves to
 * nothing while the roadmap view is toggled on, because that replaces the list in the DOM.
 */
export function selectedCourses(page: Page): Locator {
  return coursesPanel(page).locator('[role="list"] > [role=listitem]');
}

/** One row in the left "Courses" panel. */
export function selectedCourse(page: Page, sectionKey: string): Locator {
  return selectedCourses(page).filter({
    has: page.locator(`span:text-is(${JSON.stringify(sectionKey)})`),
  });
}

/** The credit figure the left panel reports for the current selection. */
export async function totalCredits(page: Page): Promise<number> {
  // The label and the figure are sibling spans, so text-matching the label
  // yields an element with no digits in it; the testid wraps both.
  const container = page.getByTestId("total-credits");
  await expect(container.getByText(/(Total Credits|Toplam Kredi)/i)).toBeVisible();
  const text = await container.innerText();
  const digits = /(\d+)/.exec(text);
  if (!digits) {
    throw new Error(`no credit total in ${JSON.stringify(text)}`);
  }
  return Number(digits[1]);
}

/** The catalogue search box: the only text input rendered inside a `<form>`. */
export function searchInput(page: Page): Locator {
  return page.locator('form input[type="text"]');
}

/**
 * Type a search query and wait for the filtered list to settle. Pass `""` to clear.
 *
 * Rewinds the scroll position first: a stale offset can leave the pagination sentinel in view
 * while the shorter list renders, which would keep appending pages during the assertion below.
 */
export async function searchCourses(page: Page, query: string): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    for (const list of document.querySelectorAll('[role="list"]')) {
      list.scrollTop = 0;
    }
  });
  await searchInput(page).fill(query);
  await expect(searchInput(page)).toHaveValue(query);
  // Any input resets pagination to page 1, so the list settles at PAGE_SIZE rows or fewer.
  await expect.poll(() => courseRows(page).count()).toBeLessThanOrEqual(PAGE_SIZE);
}

/**
 * Drive the catalogue's IntersectionObserver pagination until at least `minRows` rows are
 * rendered. Each round scrolls the catalogue container (the observer root on desktop) and the
 * window (the root on small screens), so it works in either layout, then waits for the list to
 * actually grow before scrolling again.
 */
export async function loadCourseRows(page: Page, minRows: number): Promise<void> {
  const maxRounds = Math.ceil(minRows / PAGE_SIZE) + 2;
  for (let round = 0; round < maxRounds; round += 1) {
    const rendered = await courseRows(page).count();
    if (rendered >= minRows) {
      return;
    }
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      for (const list of document.querySelectorAll('[role="list"]')) {
        list.scrollTop = list.scrollHeight;
      }
    });
    await expect.poll(() => courseRows(page).count()).toBeGreaterThan(rendered);
  }
  expect(await courseRows(page).count()).toBeGreaterThanOrEqual(minRows);
}

/** The timetable `<table>` in the left pane. */
export function timetable(page: Page): Locator {
  return page.locator("table").first();
}

/**
 * Header cell of a weekday column. `dayIndex` is 0=Mon … 5=Sat; index 0 of the header row is the
 * hour gutter, hence the offset. Matched positionally because the labels are translated.
 */
export function timetableDayHeader(page: Page, dayIndex: number): Locator {
  return timetable(page).locator("thead th").nth(dayIndex + 1);
}

/**
 * A timetable body cell. `dayIndex` is 0=Mon … 5=Sat and `hour` is the displayed hour label
 * (9 … 22). Rows past the latest scheduled hour are not rendered at all — the table always ends at
 * 16 or later — so asking for a later empty hour resolves to nothing.
 */
export function timetableCell(page: Page, dayIndex: number, hour: number): Locator {
  return timetable(page)
    .locator("tbody tr")
    .nth(hour - FIRST_HOUR)
    .locator("td")
    .nth(dayIndex);
}

/** The semester `<select>` in the header. */
export function semesterSelect(page: Page): Locator {
  return page.locator("select");
}

/**
 * Switch semesters and wait until the catalogue has been repopulated from the new term's JSON.
 * Selecting a term the app has not fetched yet empties the catalogue synchronously, so waiting for
 * a non-empty list is a real signal rather than a race against the stale rows.
 */
export async function setSemester(page: Page, value: string): Promise<void> {
  const select = semesterSelect(page);
  await select.selectOption(value);
  await expect(select).toHaveValue(value);
  await expect.poll(() => courseRows(page).count(), { timeout: 30_000 }).toBeGreaterThan(0);
}

/**
 * The dark top bar: title, EN/TR toggle, semester select.
 *
 * Addressed by testid rather than by walking up from the `<h1>`. The old
 * `h1 -> ../..` hop silently depended on the title sitting inside a wrapper div,
 * so removing that wrapper pushed the locator up to a scope that also contains
 * the catalogue's two-letter department buttons — `TR` among them.
 */
export function header(page: Page): Locator {
  return page.getByTestId("app-header");
}

/** The app title in the header — the one string guaranteed to be translated. */
export function appTitle(page: Page): Locator {
  return page.locator("h1");
}

/**
 * Click the header EN/TR toggle and wait for the active-language styling to land. Scoped to the
 * header because the catalogue also renders two-letter department pills, `TR` among them.
 */
export async function setLang(page: Page, lang: "en" | "tr"): Promise<void> {
  const button = header(page).getByRole("button", { name: lang.toUpperCase(), exact: true });
  await button.click();
  // The active language is the ink-filled position of the toggle.
  await expect(button).toHaveClass(/bg-zinc-900/);
}

/**
 * Raw `localStorage` value, or `null` when unset. Deliberately unparsed: `semesterSelCourses2` and
 * `roadmap` hold JSON while `lang` holds a bare `"en"`/`"tr"`, so the caller decides.
 */
export function readStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k: string) => localStorage.getItem(k), key);
}
