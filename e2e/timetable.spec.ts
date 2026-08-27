/**
 * Timetable grid: overlap layout, narrow-screen scrolling, PNG export.
 *
 * Fixtures are pinned to `2026-2027-1`, the term the app opens on, and to
 * sections whose schedules are stable in `public/data/2026-2027-1.json`:
 *
 *   CMPE101.01          M slots 1-2 (09:00, 10:00) + T slot 8 (16:00)
 *   CMPE150.01          T slot 8 (16:00)            -> clashes at Tue 16:00
 *   CMPE150.01 P.S. 1   M slots 1-2                 -> clashes across Mon 09:00-10:00
 *   CMPE101.01 LAB 1    F slots 3-4 (11:00, 12:00)
 *   CMPE101.01 LAB 2    F slots 3-4                 -> two-hour, two-column clash
 */
import { stat } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";
import {
  FIRST_HOUR,
  gotoFresh,
  selectCourse,
  timetable,
  timetableCell,
  timetableDayHeader,
} from "./helpers";

const MON = 0;
const TUE = 1;
const FRI = 4;
const SAT = 5;

/** Bounding box of a laid-out element, asserting it has one. */
async function rect(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, "element must be laid out").not.toBeNull();
  return box!;
}

test("overlapping courses sit side by side instead of stacking the row", async ({
  page,
}) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE101.01");
  await selectCourse(page, "CMPE150.01");

  const clash = timetableCell(page, TUE, 16);
  const clashBoxes = clash.getByTestId("tt-box");
  await expect(clashBoxes).toHaveCount(2);

  // Horizontally disjoint: the whole point of sub-columns.
  const rects = await Promise.all([
    rect(clashBoxes.nth(0)),
    rect(clashBoxes.nth(1)),
  ]);
  rects.sort((a, b) => a.x - b.x);
  expect(rects[0].width).toBeGreaterThan(0);
  expect(rects[0].x + rects[0].width).toBeLessThanOrEqual(rects[1].x);

  // Both boxes fill the cell vertically, so the row cannot grow.
  const cellRect = await rect(clash);
  for (const r of rects) {
    expect(Math.abs(r.height - cellRect.height)).toBeLessThan(1.5);
    expect(r.width).toBeLessThan(cellRect.width * 0.75);
  }

  // A two-way clash row is exactly as tall as a row with one course and as a row with none.
  const rows = timetable(page).locator("tbody tr");
  const clashRow = await rect(rows.nth(16 - FIRST_HOUR));
  const singleRow = await rect(rows.nth(9 - FIRST_HOUR)); // Mon 09:00, one course
  const emptyRow = await rect(rows.nth(13 - FIRST_HOUR)); // nothing scheduled
  expect(Math.abs(clashRow.height - singleRow.height)).toBeLessThan(1);
  expect(Math.abs(clashRow.height - emptyRow.height)).toBeLessThan(1);

  // The clash is still flagged, and not only by the red tint.
  await expect(clash).toHaveAttribute("aria-label", /.+/);
  await expect(clash).toHaveClass(/bg-red-100/);
  await expect(clash).toHaveClass(/ring-red-500/);
});

test("a multi-hour course keeps one horizontal offset across every hour it spans", async ({
  page,
}) => {
  await gotoFresh(page);
  // Mon 09:00-10:00 becomes a two-column cluster: CMPE101.01 vs CMPE150.01 P.S. 1.
  await selectCourse(page, "CMPE101.01");
  await selectCourse(page, "CMPE150.01 P.S. 1");

  const first = timetableCell(page, MON, 9).locator('[data-course="CMPE101.01"]');
  const second = timetableCell(page, MON, 10).locator('[data-course="CMPE101.01"]');
  await expect(first).toHaveCount(1);
  await expect(second).toHaveCount(1);

  const top = await rect(first);
  const bottom = await rect(second);
  expect(Math.abs(top.x - bottom.x)).toBeLessThan(0.5);
  expect(Math.abs(top.width - bottom.width)).toBeLessThan(0.5);

  // It really is sub-divided, so a stable offset is a meaningful claim.
  const cellRect = await rect(timetableCell(page, MON, 9));
  expect(top.width).toBeLessThan(cellRect.width * 0.75);
  // Continuous band: the two hours are vertically adjacent, not separated.
  expect(Math.abs(top.y + top.height - bottom.y)).toBeLessThan(1);
  // Only the first hour carries the label; the continuation is a bare band.
  await expect(first).toHaveText("CMPE101.01");
  await expect(second).toHaveText("");

  // Same invariant for a clash that is two hours tall on both sides.
  await selectCourse(page, "CMPE101.01 LAB 1");
  await selectCourse(page, "CMPE101.01 LAB 2");
  for (const course of ["CMPE101.01 LAB 1", "CMPE101.01 LAB 2"]) {
    const selector = `[data-course="${course}"]`;
    const at11 = await rect(timetableCell(page, FRI, 11).locator(selector));
    const at12 = await rect(timetableCell(page, FRI, 12).locator(selector));
    expect(Math.abs(at11.x - at12.x)).toBeLessThan(0.5);
    expect(Math.abs(at11.width - at12.width)).toBeLessThan(0.5);
  }
});

test.describe("narrow screens @mobile", () => {
  test("the timetable scrolls horizontally with nothing clipped", async ({ page }) => {
    await gotoFresh(page);
    await selectCourse(page, "CMPE101.01");
    await selectCourse(page, "CMPE101.01 LAB 1");
    await selectCourse(page, "CMPE101.01 LAB 2");

    const scroller = page.getByTestId("timetable-scroll");
    await expect(scroller).toBeVisible();

    // The table keeps a usable minimum width, so the wrapper genuinely overflows.
    const metrics = await scroller.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);

    // No Saturday course is selected, so Friday is the rightmost column...
    await expect(timetableDayHeader(page, SAT)).toHaveClass(/hidden/);
    const friday = timetableDayHeader(page, FRI);

    // ...and it is off-screen until we scroll.
    const viewport = await rect(scroller);
    const before = await rect(friday);
    expect(before.x + before.width).toBeGreaterThan(viewport.x + viewport.width);

    await scroller.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect
      .poll(async () => {
        const now = await rect(friday);
        return now.x + now.width;
      })
      .toBeLessThanOrEqual(viewport.x + viewport.width + 1);

    // The hour gutter stays pinned so you never lose your place.
    const gutter = await rect(timetable(page).locator("tbody tr").first().locator("th"));
    expect(Math.abs(gutter.x - viewport.x)).toBeLessThan(2);

    // Nothing overflows its own cell: no half-rendered labels.
    const clipped = await timetable(page).evaluate((table) =>
      [...table.querySelectorAll("tbody td")]
        .filter((td) => !td.classList.contains("hidden"))
        .filter((td) => td.scrollWidth > td.clientWidth)
        .map((td) => `${td.scrollWidth}>${td.clientWidth}`),
    );
    expect(clipped).toEqual([]);
  });
});

test("the export control downloads the grid as a PNG", async ({ page }) => {
  await gotoFresh(page);

  const button = page.getByTestId("timetable-export-png");
  // Nothing to draw yet.
  await expect(button).toBeDisabled();

  await selectCourse(page, "CMPE101.01");
  await selectCourse(page, "CMPE150.01");
  await expect(button).toBeEnabled();

  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);

  const file = await download.path();
  expect(file).not.toBeNull();
  const { size } = await stat(file!);
  expect(size).toBeGreaterThan(5000);
});
