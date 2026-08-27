/**
 * Roadmap panel (P4): the multi-term planning board reachable from the left
 * "Courses" panel.
 *
 * The defect this spec pins down: term choices used to come straight from
 * `public/data/semesters.json`, which lists only the terms BOUN has already
 * published. The newest of those is the term the app opens on, so "up to six
 * upcoming terms" resolved to zero and the board rendered exactly one card —
 * a planner that cannot plan ahead. `futureTerms.mjs` now synthesises the
 * unpublished terms and predicts offerings from `offerings.json`.
 *
 * Nothing here matches a term string. The newest published term changes every
 * time the daily scrape lands a new semester, so a spec that spells one out is
 * a spec with an expiry date. The distinction that matters — BOUN said so vs.
 * we inferred it — is carried by `data-predicted` / `data-status`, and the
 * chronology is checked by parsing the `data-term` attributes the app rendered
 * and asserting they increase.
 *
 * Fixture: CMPE150, chosen because `offerings.json` records eight past
 * offerings of it, so it is predicted for a future term with real evidence
 * behind the label. The prefix `CMPE15` matches no other code.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoFresh, readStorage, waitForCatalogue } from "./helpers";

/** The course planned onto a term card, and the prefix typed to find it. */
const FIXTURE_CODE = "CMPE150";
const FIXTURE_PREFIX = "CMPE15";

/** Every confidence label `predictOffering()` can produce. */
const CONFIDENCES = ["known", "high", "medium", "low", "none"];

const CARD = '[data-testid="roadmap-term-card"]';

function termCards(page: Page): Locator {
  return page.locator(CARD);
}

/** Cards whose course list is inference, not a published catalogue. */
function predictedCards(page: Page): Locator {
  return page.locator(`${CARD}[data-predicted="true"]`);
}

/** The one card BOUN has actually published: the term the app opened on. */
function publishedCard(page: Page): Locator {
  return page.locator(`${CARD}[data-predicted="false"]`);
}

/**
 * Open the board and wait for `semesters.json` to have become cards.
 * `termsLoading` renders a placeholder first, so the first card appearing is
 * the real signal.
 */
async function openRoadmap(page: Page): Promise<void> {
  await page.getByTestId("roadmap-toggle").click();
  await expect(page.getByTestId("roadmap-panel")).toBeVisible();
  await expect(termCards(page).first()).toBeVisible();
}

/**
 * Absolute term ordinal, so "2026/2027-3" and "2027/2028-1" compare correctly.
 * Deliberately re-derived here instead of imported from `futureTerms.mjs`: the
 * module that produced these keys must not also be the authority on whether
 * they are in order.
 */
function ordinal(term: string): number {
  const parsed = /^(\d{4})\/(\d{4})-([123])$/.exec(term);
  expect(parsed, `unexpected term key: ${term}`).not.toBeNull();
  const [, start, , season] = parsed as RegExpExecArray;
  return Number(start) * 3 + Number(season);
}

/** Type into a card's add box and pick a code out of the suggestion list. */
async function addToCard(card: Locator, code: string, prefix: string): Promise<void> {
  await card.getByTestId("roadmap-add").fill(prefix);
  const suggestion = card.locator(
    `[data-testid="roadmap-suggestion"][data-code="${code}"]`,
  );
  await expect(suggestion).toHaveCount(1);
  await suggestion.click();
  await expect(
    card.locator(`[data-testid="roadmap-row"][data-code="${code}"]`),
  ).toHaveCount(1);
}

test("the board reaches past the newest published term", async ({ page }) => {
  await gotoFresh(page);
  await openRoadmap(page);

  // One published term plus the synthesised ones. Six are synthesised today;
  // four is the floor below which the panel has stopped being a roadmap.
  expect(await termCards(page).count()).toBeGreaterThanOrEqual(4);

  await expect(publishedCard(page)).toHaveCount(1);
  await expect(publishedCard(page)).toHaveAttribute("data-status", "published");
  expect(await predictedCards(page).count()).toBeGreaterThanOrEqual(3);

  // Chronological, ascending, no repeats — the synthesised keys are real terms
  // in sequence rather than decorations on the current one.
  const keys = await termCards(page).evaluateAll((cards) =>
    cards.map((card) => card.getAttribute("data-term") ?? ""),
  );
  for (let i = 1; i < keys.length; i++) {
    expect(ordinal(keys[i]), `${keys[i]} must follow ${keys[i - 1]}`).toBeGreaterThan(
      ordinal(keys[i - 1]),
    );
  }

  // Every predicted card sits after the published one, and says it is a guess.
  const publishedTerm = (await publishedCard(page).getAttribute("data-term")) ?? "";
  const predictedTerms = await predictedCards(page).evaluateAll((cards) =>
    cards.map((card) => card.getAttribute("data-term") ?? ""),
  );
  for (const term of predictedTerms) {
    expect(ordinal(term)).toBeGreaterThan(ordinal(publishedTerm));
  }
  await expect(
    predictedCards(page).first().getByTestId("roadmap-predicted-badge"),
  ).toBeVisible();
  await expect(publishedCard(page).getByTestId("roadmap-predicted-badge")).toHaveCount(0);
});

test("a course planned into a future term survives a reload", async ({ page }) => {
  await gotoFresh(page);
  await openRoadmap(page);

  const card = predictedCards(page).first();
  const term = await card.getAttribute("data-term");
  expect(term).not.toBeNull();
  await addToCard(card, FIXTURE_CODE, FIXTURE_PREFIX);

  const stored = await readStorage(page, "roadmap");
  expect(stored).not.toBeNull();
  expect(JSON.parse(stored as string)).toEqual({ [term as string]: [FIXTURE_CODE] });

  // The panel closes on reload — `showRoadmap` is view state, not persisted —
  // so the plan has to be re-opened to be seen.
  await page.reload();
  await waitForCatalogue(page);
  await openRoadmap(page);

  await expect(
    page.locator(`${CARD}[data-term="${term}"] [data-testid="roadmap-row"]`),
  ).toHaveAttribute("data-code", FIXTURE_CODE);
});

test("a predicted offering is labelled as a prediction, never as fact", async ({
  page,
}) => {
  await gotoFresh(page);
  await openRoadmap(page);

  const predicted = predictedCards(page).first();
  await addToCard(predicted, FIXTURE_CODE, FIXTURE_PREFIX);
  await addToCard(publishedCard(page), FIXTURE_CODE, FIXTURE_PREFIX);

  // On a predicted term the row carries a confidence badge whose tooltip spells
  // out the evidence — how often the course ran in this season, when it last
  // ran — so the label is auditable instead of authoritative.
  const badge = predicted.getByTestId("roadmap-confidence");
  await expect(badge).toHaveCount(1);
  expect(CONFIDENCES).toContain(await badge.getAttribute("data-confidence"));
  const label = (await badge.innerText()).trim();
  const detail = (await badge.getAttribute("title")) ?? "";
  expect(label.length).toBeGreaterThan(0);
  expect(detail.length).toBeGreaterThan(label.length);

  // The published term is BOUN's word: no confidence badge, because there is
  // nothing to be confident about.
  await expect(publishedCard(page).getByTestId("roadmap-confidence")).toHaveCount(0);

  // Credit totals for a term with no published catalogue are approximations and
  // are marked as such.
  await expect(predicted.getByTestId("roadmap-load")).toContainText("≈");
  await expect(publishedCard(page).getByTestId("roadmap-load")).not.toContainText("≈");
});
