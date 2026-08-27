/**
 * Two-way URL state: the address bar mirrors the selection, Back/Forward walk
 * between selection states, share links win once and are then scrubbed.
 *
 * Also pins the payload rule this slice introduced: `data/descriptions.json`
 * (~244 KB gzipped) must never be part of the initial load.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  courseRows,
  gotoFresh,
  searchCourses,
  sectionKeys,
  selectCourse,
  selectedCourse,
  selectedCourses,
  semesterSelect,
  STORAGE_KEYS,
} from "./helpers";

/** Read `?d=`/`?c=` back out of whatever the app put in the address bar. */
function shareParams(page: Page) {
  const params = new URL(page.url()).searchParams;
  return {
    semester: params.get("d"),
    courses: (params.get("c") ?? "").split(",").filter(Boolean),
  };
}

test("adding a course writes the selection into the address bar", async ({ page }) => {
  await gotoFresh(page);
  const term = await semesterSelect(page).inputValue();
  const [first] = await sectionKeys(page);

  expect(new URL(page.url()).search).toBe("");

  await selectCourse(page, first);

  const mirrored = shareParams(page);
  expect(mirrored.semester).toBe(term);
  expect(mirrored.courses).toEqual([first]);
});

test("Back reverts a selection edit, Forward reapplies it", async ({ page }) => {
  await gotoFresh(page);
  const [first, second] = await sectionKeys(page);

  await selectCourse(page, first);
  await selectCourse(page, second);
  await expect(selectedCourses(page)).toHaveCount(2);

  // Each add/remove pushes its own history entry, so Back is an undo.
  await page.goBack();
  await expect(selectedCourses(page)).toHaveCount(1);
  await expect(selectedCourse(page, first)).toHaveCount(1);
  expect(shareParams(page).courses).toEqual([first]);

  await page.goBack();
  await expect(selectedCourses(page)).toHaveCount(0);
  expect(new URL(page.url()).search).toBe("");

  await page.goForward();
  await expect(selectedCourses(page)).toHaveCount(1);
  expect(shareParams(page).courses).toEqual([first]);
});

test("a ?d=&c= link applies the selection and is scrubbed from the URL", async ({ page }) => {
  await gotoFresh(page);
  const term = await semesterSelect(page).inputValue();
  const [first, second] = await sectionKeys(page);
  const shared = `${first},${second}`;

  await page.goto(`./?d=${encodeURIComponent(term)}&c=${encodeURIComponent(shared)}`);
  await expect(courseRows(page).first()).toBeVisible();

  await expect(selectedCourse(page, first)).toHaveCount(1);
  await expect(selectedCourse(page, second)).toHaveCount(1);
  await expect(semesterSelect(page)).toHaveValue(term);

  // Scrubbed, so a later reload cannot resurrect this selection over the
  // user's own subsequent edits.
  expect(new URL(page.url()).search).toBe("");
});

test("a ?c= link with no ?d= still applies to the current term", async ({ page }) => {
  // Regression: the share block used to run at module load, where the
  // `currentSemester` rune was still "", so a `?c=`-only link wrote its
  // selection under the "" key and silently dropped it.
  await gotoFresh(page);
  const [first] = await sectionKeys(page);

  await page.goto(`./?c=${encodeURIComponent(first)}`);
  await expect(courseRows(page).first()).toBeVisible();

  await expect(selectedCourse(page, first)).toHaveCount(1);
  await expect(selectedCourses(page)).toHaveCount(1);
  expect(new URL(page.url()).search).toBe("");
});

test("a share link beats a stored selection, for its term only", async ({ page }) => {
  await gotoFresh(page);
  const term = await semesterSelect(page).inputValue();
  const [first, second] = await sectionKeys(page);

  // Pre-seed storage the way a returning user would have it. `gotoFresh` only
  // wipes once per context, so this survives the navigation below.
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    {
      key: STORAGE_KEYS[0],
      value: JSON.stringify({ [term]: [second], "1900-1901-1": ["GHOST101.01"] }),
    },
  );

  await page.goto(`./?d=${encodeURIComponent(term)}&c=${encodeURIComponent(first)}`);
  await expect(courseRows(page).first()).toBeVisible();

  await expect(selectedCourse(page, first)).toHaveCount(1);
  await expect(selectedCourses(page)).toHaveCount(1);

  // Untouched terms keep their stored plans.
  const stored = await page.evaluate(
    (key: string) => JSON.parse(localStorage.getItem(key) ?? "{}"),
    STORAGE_KEYS[0],
  );
  expect(stored[term]).toEqual([first]);
  expect(stored["1900-1901-1"]).toEqual(["GHOST101.01"]);
});

test("descriptions.json is not part of the initial load, only of the search fallback", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));

  await gotoFresh(page);

  // Guard against a vacuous pass: the listener really did see the eager loaders.
  expect(requested.some((url) => url.includes("offerings.json"))).toBe(true);
  expect(requested.filter((url) => url.includes("descriptions.json"))).toEqual([]);

  // A query that matches no course code, name or instructor is the only thing
  // that still needs the catalog text — and it fetches it on demand.
  const fetched = page.waitForResponse((response) =>
    response.url().includes("descriptions.json"),
  );
  await searchCourses(page, "zzzqqq");
  await fetched;
});
