/**
 * Theme toggle: follows the OS until the student picks, then persists.
 *
 * `html[data-theme]` is the resolved scheme the CSS actually uses. Playwright's
 * `colorScheme` fixture is the OS preference; `gotoFresh` wipes `theme` from
 * localStorage so the first assertion is against the system, not a leftover.
 */
import { expect, test } from "@playwright/test";
import { gotoFresh, header, setLang } from "./helpers";

test.describe("follows the OS when no preference is stored", () => {
  test.use({ colorScheme: "light" });

  test("starts light", async ({ page }) => {
    await gotoFresh(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByTestId("theme-toggle")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

test.describe("dark OS preference", () => {
  test.use({ colorScheme: "dark" });

  test("starts dark", async ({ page }) => {
    await gotoFresh(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByTestId("theme-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

test.describe("manual override", () => {
  test.use({ colorScheme: "light" });

  test("toggles, persists across reload, and is labelled in both languages", async ({
    page,
  }) => {
    await gotoFresh(page);

    const toggle = page.getByTestId("theme-toggle");
    await expect(toggle).toHaveAttribute(
      "aria-label",
      "Switch to dark theme",
    );
    await toggle.click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
      "dark",
    );

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await setLang(page, "tr");
    await expect(header(page).getByTestId("theme-toggle")).toHaveAttribute(
      "aria-label",
      "Açık temaya geç",
    );
  });
});
