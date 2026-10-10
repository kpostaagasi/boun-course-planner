import { test, expect } from "@playwright/test";
import { gotoFresh, waitForCatalogue, searchInput, selectCourse } from "./helpers";

test.beforeEach(async ({ page }) => {
  await gotoFresh(page, "?d=2026-2027-1");
  await waitForCatalogue(page);
});

test("finds alternatives and applies them", async ({ page }) => {
  await searchInput(page).fill("CMPE150");
  await selectCourse(page, "CMPE150.01");

  await searchInput(page).fill("PHYS101");
  await selectCourse(page, "PHYS101.01");

  const noEarly = page.locator('label', { hasText: /No 09:00 classes|09:00 dersi olmasın/ }).locator("input");
  await noEarly.check();

  await page.getByRole("button", { name: /Find alternatives|Alternatifleri bul/ }).click();

  await expect(page.getByText(/Option|Seçenek/)).toBeVisible();

  await page.getByRole("button", { name: /Apply|Uygula/ }).click();

  await expect(page.getByTestId("solver-message")).toBeVisible();
});
