/**
 * Command palette (P9): the Cmd/Ctrl+K quick-add surface.
 *
 * Two defects are pinned here.
 *
 * 1. `buildPaletteEntries` used to emit only `{courseName, code, title,
 *    instructor}`, so searching "calculus" produced five rows all reading
 *    "MATH101 CALCULUS I", two pairs of them with identical instructors, with
 *    no section number and no meeting time. Enter adds the highlighted row
 *    immediately, so the user was picking blind. A row now carries the section
 *    key and when the section meets.
 * 2. A second document-level keydown listener made Cmd+K open and immediately
 *    close again (fixed in 5164190). One keypress must produce one transition.
 *
 * Every assertion here is language-independent. Day labels are translated, so
 * a meeting time is matched as an `HH:MM` clock and a section as the `.NN`
 * suffix; an unscheduled section is recognised by `data-scheduled="false"`
 * rather than by the word it renders. The palette's own dictionary keys are
 * therefore free to change without touching this spec.
 *
 * Fixtures come from the term the app opens on. MATH101 is pinned because it is
 * the course the original bug report was written against — five sections, two
 * of them sharing an instructor. The unscheduled section is *discovered* from
 * the term's own JSON rather than named, since which sections lack a timetable
 * changes every semester.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoFresh, selectedCourses, semesterSelect } from "./helpers";

/** A section key ends in a two-digit section number: "MATH101.01". */
const SECTION_SUFFIX = /\.\d{2}(\s|$)/;

/** A rendered meeting time always contains a 24-hour clock. */
const CLOCK = /\d{2}:\d{2}/;

/** The course the "five identical rows" report was filed against. */
const FIXTURE_QUERY = "MATH101";

function dialog(page: Page): Locator {
  return page.getByTestId("palette-dialog");
}

function rows(page: Page): Locator {
  return page.getByTestId("palette-row");
}

/** The row Enter would add. */
function activeRow(page: Page): Locator {
  return page.locator('[data-testid="palette-row"][data-active="true"]');
}

async function openPalette(page: Page): Promise<void> {
  await page.keyboard.press("ControlOrMeta+k");
  await expect(dialog(page)).toBeVisible();
}

async function search(page: Page, query: string): Promise<void> {
  await page.getByTestId("palette-input").fill(query);
  await expect(rows(page).first()).toBeVisible();
}

/**
 * @returns what each result row shows: the section it is, when it meets, and
 * whether it claims to be timetabled at all.
 */
async function renderedRows(
  page: Page,
): Promise<{ key: string; when: string; scheduled: string; text: string }[]> {
  return rows(page).evaluateAll((items) =>
    items.map((item) => ({
      key: item.getAttribute("data-section-key") ?? "",
      when:
        item.querySelector('[data-testid="palette-when"]')?.textContent?.trim() ?? "",
      scheduled: item.getAttribute("data-scheduled") ?? "",
      text: (item as HTMLElement).innerText,
    })),
  );
}

test("one Cmd+K opens the palette, and only a second one closes it", async ({
  page,
}) => {
  await gotoFresh(page);

  await page.keyboard.press("ControlOrMeta+k");
  await expect(dialog(page)).toBeVisible();
  // The duplicate-listener bug opened and closed within the same keypress, so
  // the palette has to still be there a moment later, not just at first look.
  await page.waitForTimeout(300);
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId("palette-input")).toBeFocused();

  await page.keyboard.press("ControlOrMeta+k");
  await expect(dialog(page)).toBeHidden();
});

test("sibling sections of one course are told apart by section and time", async ({
  page,
}) => {
  await gotoFresh(page);
  await openPalette(page);
  await search(page, FIXTURE_QUERY);

  const shown = await renderedRows(page);
  expect(shown.length).toBeGreaterThanOrEqual(2);

  for (const row of shown) {
    expect(row.key, "every row names its section").toMatch(SECTION_SUFFIX);
    // The key is the disambiguator, so it has to be on screen and not merely
    // in an attribute the user cannot see.
    expect(row.text).toContain(row.key);
    expect(row.when, `${row.key} says nothing about when it meets`).not.toBe("");
    if (row.scheduled === "true") {
      expect(row.when, `${row.key} is timetabled but shows no clock`).toMatch(CLOCK);
    }
  }

  // Section keys are unique, so no two rows are the same row.
  const keys = shown.map((row) => row.key);
  expect(new Set(keys).size).toBe(keys.length);

  // The actual complaint was rows that differed *only* by an invisible key.
  // Within one course, the meeting time must genuinely vary per section.
  const siblings = shown.filter((row) => row.key.startsWith(`${FIXTURE_QUERY}.`));
  expect(siblings.length).toBeGreaterThanOrEqual(2);
  expect(new Set(siblings.map((row) => row.when)).size).toBeGreaterThanOrEqual(2);
});

test("a section with no timetable says so instead of leaving the time blank", async ({
  page,
}) => {
  await gotoFresh(page);

  // Which sections are untimetabled (theses, internships, unscheduled
  // seminars — about 42% of a live term) changes every semester, so the
  // fixture is read out of the term the app is actually showing.
  const term = await semesterSelect(page).inputValue();
  const key = await page.evaluate(async (file: string) => {
    const res = await fetch(`./data/${file}.json`);
    if (!res.ok) return null;
    const data: Record<string, { days?: string[] }> = await res.json();
    for (const [section, info] of Object.entries(data)) {
      // Keys with spaces ("AD251.01 P.S. 1") tokenise into several search
      // terms; keep the fixture to a single token.
      if (!section.includes(" ") && (info.days ?? []).length === 0) return section;
    }
    return null;
  }, term);
  test.skip(key === null, `no unscheduled section in ${term}`);

  await openPalette(page);
  await search(page, key as string);

  const row = page.locator(`[data-testid="palette-row"][data-section-key="${key}"]`);
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-scheduled", "false");
  const when = (await row.getByTestId("palette-when").innerText()).trim();
  expect(when).not.toBe("");
  expect(when, "an unscheduled section must not fake a meeting time").not.toMatch(CLOCK);
});

test("ArrowDown then Enter adds the highlighted section, and only that one", async ({
  page,
}) => {
  await gotoFresh(page);
  await expect(selectedCourses(page)).toHaveCount(0);

  await openPalette(page);
  await search(page, FIXTURE_QUERY);

  const first = await activeRow(page).getAttribute("data-section-key");
  await page.keyboard.press("ArrowDown");
  const second = await activeRow(page).getAttribute("data-section-key");
  expect(second).not.toBe(first);
  await expect(activeRow(page)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeHidden();

  // Exactly the highlighted section, exactly once.
  await expect(selectedCourses(page)).toHaveCount(1);
  await expect(selectedCourses(page)).toContainText(second as string);
});

test("Esc closes the palette and Tab cannot escape it", async ({ page }) => {
  await gotoFresh(page);
  await openPalette(page);
  await search(page, FIXTURE_QUERY);

  // The overlay is not inert, so without the trap Tab walks straight into the
  // catalogue behind it.
  for (const key of ["Tab", "Shift+Tab", "Tab"]) {
    await page.keyboard.press(key);
    expect(
      await dialog(page).evaluate((node) => node.contains(document.activeElement)),
      `focus left the dialog after ${key}`,
    ).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
});
