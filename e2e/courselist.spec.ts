/**
 * Left "Courses" panel: translated copy, the credit-total wording the shared
 * helper matches on, the two distinct conflict-free solver outcomes, and the
 * share link.
 *
 * Fixtures are pinned to `2026-2027-1`, the term the app opens on, and to
 * sections whose schedules are stable in `public/data/2026-2027-1.json`:
 *
 *   CMPE101.01          M slots 1-2 + T slot 8, 4 credits
 *   CMPE101.01 LAB 1    F slots 3-4  \ identical slots, and `groupKey` leaves each
 *   CMPE101.01 LAB 2    F slots 3-4  / in a group of one -> provably unsatisfiable
 *   CMPE150.01          T slot 8     \ clash at Tue 16:00, resolvable by swapping
 *   PHYS331.01          T slot 8     / CMPE150.01 for CMPE150.02
 *
 * The solver outcome is asserted through `data-solver-outcome` rather than by
 * reading the sentence: "proven impossible" and "search gave up" are different
 * facts, and the test must pin the fact, not the translation of it.
 */
import { expect, test } from "@playwright/test";
import {
  coursesPanel,
  gotoFresh,
  selectCourse,
  selectedCourse,
  selectedCourses,
  setLang,
  totalCredits,
} from "./helpers";

declare global {
  interface Window {
    /** Links the share-link spec captures from its stubbed clipboard. */
    __copiedLinks?: string[];
  }
}

const EN_EMPTY = "You have no selected course";

test("the empty state is translated, not hardcoded English", async ({ page }) => {
  await gotoFresh(page);

  const empty = page.getByTestId("courses-empty");
  await expect(empty).toHaveText(EN_EMPTY);

  await setLang(page, "tr");
  const translated = (await empty.innerText()).trim();
  expect(translated).not.toBe(EN_EMPTY);
  // A missing dictionary entry renders as the key itself, which would otherwise
  // pass the "it changed" assertion above while showing the user `list.empty`.
  expect(translated).not.toBe("list.empty");
  expect(translated.length).toBeGreaterThan(0);
});

test("the credit total keeps the wording helpers.ts matches on, in both languages", async ({
  page,
}) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE101.01");

  expect(await totalCredits(page)).toBe(4);

  await setLang(page, "tr");
  // The load-bearing half of the coupling: `totalCredits()` finds the figure
  // with /(Total Credits|Toplam Kredi)/i, so the Turkish wording is not free to
  // drift without breaking every spec that reads the credit total.
  await expect(
    coursesPanel(page).getByText(/Toplam Kredi/).first(),
  ).toBeVisible();
  expect(await totalCredits(page)).toBe(4);
});

test("two conflicting labs report a proven impossibility, not a search that gave up", async ({
  page,
}) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE101.01 LAB 1");
  await selectCourse(page, "CMPE101.01 LAB 2");

  await page.getByTestId("find-conflict-free").click();

  const message = page.getByTestId("solver-message");
  await expect(message).toHaveAttribute("data-solver-outcome", "unsatisfiable");
  await expect(message).toContainText("No conflict-free combination exists");
  await expect(message).toContainText("CMPE101.01 LAB 2");
  // The budget-exhausted wording proves nothing and must never appear for a
  // fully explored search tree.
  await expect(message).not.toContainText("gave up");
  // ...and the impossibility claim is qualified, because the solver never swaps
  // a lab for a free alternative.
  await expect(message).toContainText("Labs and problem sessions");

  // A failed solve leaves the selection alone, so there is nothing to undo.
  await expect(page.getByTestId("solver-undo")).toHaveCount(0);
  await expect(selectedCourse(page, "CMPE101.01 LAB 1")).toHaveCount(1);
  await expect(selectedCourse(page, "CMPE101.01 LAB 2")).toHaveCount(1);
});

test("undo restores the selection the solver replaced", async ({ page }) => {
  await gotoFresh(page);
  await selectCourse(page, "CMPE150.01");
  await selectCourse(page, "PHYS331.01");
  await expect(selectedCourses(page)).toHaveCount(2);

  await page.getByTestId("find-conflict-free").click();

  const message = page.getByTestId("solver-message");
  await expect(message).toHaveAttribute("data-solver-outcome", "applied");
  await expect(selectedCourse(page, "CMPE150.02")).toHaveCount(1);
  await expect(selectedCourse(page, "CMPE150.01")).toHaveCount(0);
  await expect(selectedCourse(page, "PHYS331.01")).toHaveCount(1);

  await page.getByTestId("solver-undo").click();

  await expect(selectedCourse(page, "CMPE150.01")).toHaveCount(1);
  await expect(selectedCourse(page, "CMPE150.02")).toHaveCount(0);
  await expect(selectedCourses(page)).toHaveCount(2);
  await expect(page.getByTestId("solver-message")).toHaveCount(0);
  await expect(page.getByTestId("solver-undo")).toHaveCount(0);
});

test("the share link is built from the urlState wire format", async ({ page }) => {
  // Deterministic stand-in for the real clipboard: `navigator.clipboard.readText`
  // needs document focus plus a permission grant, and neither is what this
  // asserts. Registered before `gotoFresh` so both init scripts run.
  await page.addInitScript(() => {
    const copied: string[] = [];
    window.__copiedLinks = copied;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          copied.push(text);
          return Promise.resolve();
        },
      },
    });
  });
  await gotoFresh(page);
  await selectCourse(page, "CMPE101.01");
  await selectCourse(page, "CMPE101.01 LAB 1");

  await page.getByTestId("copy-share-link").click();

  const copied = await page.evaluate(() => window.__copiedLinks ?? []);
  expect(copied).toHaveLength(1);
  const link = new URL(copied[0]);
  expect(link.pathname).toBe(new URL(page.url()).pathname);
  expect(link.searchParams.get("d")).toBe("2026-2027-1");
  // A section key with spaces round-trips: URLSearchParams encodes them as `+`
  // where the old hand-rolled template used %20, and both decode identically.
  expect(link.searchParams.get("c")).toBe("CMPE101.01,CMPE101.01 LAB 1");
});

test("a failed semester-dates fetch explains itself instead of a dead button", async ({
  page,
}) => {
  // The file covers 6 of the 25 terms, so the default term does have dates:
  // failing the fetch is the only way to reach the branch, and it used to be
  // reported to the user as "select courses to enable calendar export".
  await page.route(/semester-dates\.json/, (route) => route.abort());
  await gotoFresh(page);
  await selectCourse(page, "CMPE101.01");

  const reason = page.getByTestId("calendar-reason");
  await expect(reason).toHaveAttribute("data-dates-status", "failed");
  await expect(reason).toContainText("Term dates could not be loaded");
  await expect(page.getByTestId("calendar-ics")).toBeDisabled();
  // The Google Calendar button shares the gate, so it is not rendered at all.
  await expect(page.getByTestId("calendar-gcal")).toHaveCount(0);
});
