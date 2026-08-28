import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoFresh, selectCourse, searchCourses } from "./helpers";

/**
 * Accessibility gate: axe-core over the app's five interactive surfaces, in
 * both colour schemes. The bar is zero serious and zero critical violations —
 * which includes WCAG contrast, so this is also the machine check on the
 * palette's contrast choices.
 *
 * Moderate/minor findings are reported in the console but do not fail the
 * gate: they are real, but the goal's acceptance line is serious+critical.
 */

type Scheme = "light" | "dark";
const SCHEMES: Scheme[] = ["light", "dark"];

async function expectNoSeriousViolations(page: Page, surface: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  for (const v of results.violations) {
    if (v.impact !== "serious" && v.impact !== "critical") {
      console.log(`[a11y:${surface}] ${v.impact}: ${v.id} (${v.nodes.length} nodes)`);
    }
  }
  expect(
    blocking.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5),
    })),
    `${surface}: no serious/critical axe violations`,
  ).toEqual([]);
}

for (const scheme of SCHEMES) {
  test.describe(`a11y in ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test(`initial load is clean (${scheme})`, async ({ page }) => {
      await gotoFresh(page);
      await expectNoSeriousViolations(page, `initial/${scheme}`);
    });

    test(`command palette is clean (${scheme})`, async ({ page }) => {
      await gotoFresh(page);
      await page.keyboard.press("ControlOrMeta+k");
      await expect(page.getByTestId("palette-input")).toBeVisible();
      await page.getByTestId("palette-input").fill("calculus");
      await expect(page.getByTestId("palette-row").first()).toBeVisible();
      await expectNoSeriousViolations(page, `palette/${scheme}`);
    });

    test(`filters dialog is clean and traps focus (${scheme})`, async ({ page }) => {
      await gotoFresh(page);
      await page.getByTestId("filters-open").click();
      await expect(page.getByTestId("filters-apply")).toBeVisible();
      await expectNoSeriousViolations(page, `filters/${scheme}`);

      // G9: a modal <dialog> must not leak Tab focus to the page behind it.
      // 20 Tab presses walk well past the dialog's own focusable count, so if
      // focus could escape, it would.
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press("Tab");
        const inside = await page.evaluate(() => {
          const dialog = document.querySelector("dialog[open]");
          return !!dialog && dialog.contains(document.activeElement);
        });
        expect(inside, `Tab press ${i + 1} stayed inside the dialog`).toBe(true);
      }
    });

    test(`roadmap is clean (${scheme})`, async ({ page }) => {
      await gotoFresh(page);
      await page.getByTestId("roadmap-toggle").click();
      await expect(page.getByTestId("roadmap-panel")).toBeVisible();
      await expectNoSeriousViolations(page, `roadmap/${scheme}`);
    });

    test(`instructor panel is clean (${scheme})`, async ({ page }) => {
      await gotoFresh(page);
      // Reach the panel the way a user does: click an instructor on a card.
      await selectCourse(page, "CMPE150.01");
      await searchCourses(page, "CMPE150");
      const instructorButton = page.getByTestId("course-instructor").first();
      await instructorButton.click();
      await expect(page.getByTestId("instructor-panel")).toBeVisible();
      await expectNoSeriousViolations(page, `instructor/${scheme}`);
    });
  });
}
