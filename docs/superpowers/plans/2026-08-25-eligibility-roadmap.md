# Eligibility Badges (A) + Roadmap Panel (B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students mark completed courses to see eligibility badges (A) and plan courses across future semesters in a roadmap panel (B).

**Architecture:** Two new pure-logic modules (`eligibility.ts`, `roadmapLogic.ts`) tested with node:test; state extensions in `globalState.svelte.ts` (localStorage-persisted); UI additions to `Course.svelte` (✓ toggle + badge) and a new `Roadmap.svelte` panel toggled from the Courses panel header.

**Tech Stack:** Svelte 5 (runes), TypeScript, Tailwind, node:test, i18n.svelte.ts dictionary.

**Spec:** docs/superpowers/specs/2026-08-25-eligibility-roadmap-design.md

## Global Constraints

- Tests run with `npm test` → `node --test tools/lib/test/*.test.mjs` AND frontend logic tests must be wired the same way: put frontend logic tests in `tools/lib/test/` too (node:test imports TS? NO — logic modules must be `.mjs`-importable). RESOLUTION (see Ruling in ledger): logic modules live in `src/lib/eligibility.ts` and `src/lib/roadmapLogic.ts` (TypeScript, app imports them); their tests live in `tools/lib/test/eligibility.test.mjs` and `tools/lib/test/roadmap.test.mjs` and import via a thin `.mjs` re-export shim `src/lib/eligibility.mjs` / `src/lib/roadmapLogic.mjs` that contains the SAME pure functions in plain JS. To avoid dual-maintenance drift: the `.ts` file re-exports from the `.mjs` file (`export * from "./eligibility.mjs"`), so the `.mjs` is the single implementation and TS types live in a sibling `eligibility.d.ts`-style declaration inside the `.ts` module. Concretely: implement pure logic in `src/lib/eligibility.mjs` (plain JS + JSDoc), `src/lib/eligibility.ts` re-exports it and adds types; tests import the `.mjs` directly.
- All new UI strings go through `t()` from `src/lib/i18n.svelte.ts`; add keys for both `en` and `tr`.
- Course codes are base codes ("CMPE150") — strip section suffix via `course.code.split(".")[0]`.
- Dangling prerequisite references (codes absent from prereqs.json) are ignored, never blocking (spec decision).
- localStorage keys: `completedCourses`, `roadmap`. Guard all localStorage access with try/catch (private mode).
- Svelte 5 runes: `$state`, `$derived` — no legacy stores.
- `npm test`, `npx svelte-check --tsconfig ./tsconfig.app.json`, and `npm run build` must all pass at every task boundary.

---

### Task 1: Eligibility logic module (A core)

**Files:**
- Create: `src/lib/eligibility.mjs`
- Create: `src/lib/eligibility.ts` (re-export + TS types)
- Test: `tools/lib/test/eligibility.test.mjs`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `export type Eligibility = "taken" | "eligible" | "missing-prereq" | "no-data"`; `export function getEligibility(baseCode, completedSet, prereqs)` returning `{ status: Eligibility, missing: string[] }` — `missing` non-empty only for `missing-prereq`, capped at 3 entries plus boolean `moreMissing` when truncated. NOTE for later tasks: the return is an OBJECT `{status, missing, moreMissing}`, not a bare string.

- [ ] **Step 1: Write the failing tests**

```js
// tools/lib/test/eligibility.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { getEligibility } from "../../src/lib/eligibility.mjs";

const prereqs = {
  CMPE210: { prereqs: ["CMPE150"] },
  CMPE300: { prereqs: ["CMPE210", "MATH202"] },
  SOC999: { prereqs: ["SOC101"] }, // dangling: SOC101 not in prereqs map
};

test("taken when code is in completed set", () => {
  assert.deepEqual(getEligibility("CMPE210", new Set(["CMPE210"]), prereqs), {
    status: "taken", missing: [], moreMissing: false,
  });
});

test("eligible when all prereqs completed", () => {
  assert.deepEqual(getEligibility("CMPE210", new Set(["CMPE150"]), prereqs).status, "eligible");
});

test("missing-prereq lists unmet prereqs", () => {
  const r = getEligibility("CMPE300", new Set(["CMPE150"]), prereqs);
  assert.equal(r.status, "missing-prereq");
  assert.deepEqual(r.missing.sort(), ["CMPE210", "MATH202"]);
});

test("eligible ignores dangling prereq references", () => {
  assert.equal(getEligibility("SOC999", new Set(), prereqs).status, "eligible");
});

test("no-data when prereqs map lacks the code", () => {
  assert.equal(getEligibility("MATH101", new Set(), prereqs).status, "no-data");
});

test("no-data when prereqs map is null", () => {
  assert.equal(getEligibility("CMPE210", new Set(), null).status, "no-data");
});

test("missing list capped at 3 with moreMissing flag", () => {
  const many = { X: { prereqs: ["A", "B", "C", "D", "E"] } };
  const r = getEligibility("X", new Set(), many);
  assert.equal(r.missing.length, 3);
  assert.equal(r.moreMissing, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tools/lib/test/eligibility.test.mjs`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/lib/eligibility.mjs`**

```js
/**
 * Pure eligibility logic: given a course code, the set of completed course
 * codes, and the prereqs.json map, decide whether the course is taken,
 * eligible, or missing prerequisites. Dangling prereq references (codes not
 * present in the prereqs map) are ignored — see spec decision.
 */

/**
 * @param {string} baseCode
 * @param {Set<string>} completed
 * @param {Record<string, { prereqs: string[] }> | null} prereqs
 * @returns {{ status: "taken"|"eligible"|"missing-prereq"|"no-data", missing: string[], moreMissing: boolean }}
 */
export function getEligibility(baseCode, completed, prereqs) {
  if (completed.has(baseCode)) {
    return { status: "taken", missing: [], moreMissing: false };
  }
  const entry = prereqs?.[baseCode];
  if (!entry) {
    return { status: "no-data", missing: [], moreMissing: false };
  }
  const missing = (entry.prereqs || []).filter(
    (p) => !completed.has(p) && (prereqs ? p in prereqs : false),
  );
  if (missing.length === 0) {
    return { status: "eligible", missing: [], moreMissing: false };
  }
  const moreMissing = missing.length > 3;
  return {
    status: "missing-prereq",
    missing: missing.slice(0, 3),
    moreMissing,
  };
}
```

- [ ] **Step 4: Implement `src/lib/eligibility.ts`**

```ts
// @ts-expect-error re-export of plain-JS pure logic (tested via node:test)
export { getEligibility } from "./eligibility.mjs";

export type EligibilityStatus =
  | "taken"
  | "eligible"
  | "missing-prereq"
  | "no-data";

export type EligibilityResult = {
  status: EligibilityStatus;
  missing: string[];
  moreMissing: boolean;
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tools/lib/test/eligibility.test.mjs`
Expected: PASS (7/7)

- [ ] **Step 6: Commit**

```bash
git add src/lib/eligibility.mjs src/lib/eligibility.ts tools/lib/test/eligibility.test.mjs
git commit -m "feat(eligibility): pure eligibility logic with node:test coverage"
```

### Task 2: Completed-courses state (A state)

**Files:**
- Modify: `src/lib/globalState.svelte.ts` (append after the descriptions section at end of file)

**Interfaces:**
- Consumes: nothing new.
- Produces: `toggleCompleted(code: string)`, `isCompleted(code: string): boolean`, `getCompletedCourses(): string[]` (all reactive over an internal `$state<Set<string>>`), `loadCompleted()` called from App.svelte onMount (localStorage restore, try/catch).

- [ ] **Step 1: Implement in `src/lib/globalState.svelte.ts`** (append at end)

```ts
// ---- Completed courses (eligibility feature) ----
const completedCourses = $state<Set<string>>(new Set());
let completedLoaded = false;

export function loadCompleted(): void {
  if (completedLoaded) return;
  completedLoaded = true;
  try {
    const raw = localStorage.getItem("completedCourses");
    if (raw) {
      const arr: string[] = JSON.parse(raw);
      for (const code of arr) completedCourses.add(code);
    }
  } catch {
    // private mode / corrupt data: start empty
  }
}

export function toggleCompleted(code: string): void {
  if (completedCourses.has(code)) {
    completedCourses.delete(code);
  } else {
    completedCourses.add(code);
  }
  try {
    localStorage.setItem("completedCourses", JSON.stringify([...completedCourses]));
  } catch {
    // ignore persistence failures
  }
}

export function isCompleted(code: string): boolean {
  return completedCourses.has(code);
}

export function getCompletedCourses(): string[] {
  return [...completedCourses];
}
```

- [ ] **Step 2: Wire `loadCompleted()` in `src/App.svelte`** — inside `onMount`, add `loadCompleted();` next to the other loaders (import it from `./lib/globalState.svelte`).

- [ ] **Step 3: Verify**

Run: `npx svelte-check --tsconfig ./tsconfig.app.json`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/globalState.svelte.ts src/App.svelte
git commit -m "feat(eligibility): completed-courses reactive state with localStorage persistence"
```

### Task 3: Eligibility UI on course rows (A UI)

**Files:**
- Modify: `src/lib/Course.svelte`
- Modify: `src/lib/i18n.svelte.ts`

**Interfaces:**
- Consumes: `getEligibility` (Task 1), `toggleCompleted`/`isCompleted` (Task 2), `t()` from i18n, existing `getPrereqsFor` in globalState.
- Produces: badge + ✓ toggle on every course row.

- [ ] **Step 1: Add i18n keys** to `src/lib/i18n.svelte.ts` dictionary:

```ts
"course.taken": { en: "Taken", tr: "Alındı" },
"course.eligible": { en: "Eligible", tr: "Alınabilir" },
"course.needs": { en: "Needs:", tr: "Gerekli:" },
"course.markTaken": { en: "Mark as taken", tr: "Alındı olarak işaretle" },
"course.markNotTaken": { en: "Unmark as taken", tr: "İşareti kaldır" },
```

- [ ] **Step 2: In `Course.svelte` script**, add imports and derived:

```ts
import { toggleCompleted, isCompleted } from "./globalState.svelte";
import { getEligibility } from "./eligibility.ts";
// inside component body, next to prereqInfo:
const completedSet = $derived(new Set(getCompletedCourses()));
const eligibility = $derived(
  getEligibility(
    course.code.split(".")[0].replace(/\s+/g, ""),
    completedSet,
    prereqMap, // see below
  ),
);
```

`prereqMap`: `getPrereqsFor` returns per-code lookups, not the whole map. Add
`getPrereqsAll(): Record<string, PrereqInfo> | null` to globalState (returns
the internal `prereqData`), and use it here. This is a 3-line addition to
globalState — include it in this task.

- [ ] **Step 3: Badge markup** — in the title row (the flex div containing
`courseName` span), after the credits/ECTS spans add:

```svelte
{#if eligibility.status === "taken"}
  <span class="text-xs font-medium text-green-600 dark:text-green-400 mr-2">✓ {t("course.taken")}</span>
{:else if eligibility.status === "eligible"}
  <span class="text-xs text-zinc-400 dark:text-zinc-500 mr-2">{t("course.eligible")}</span>
{:else if eligibility.status === "missing-prereq"}
  <span class="text-xs text-amber-600 dark:text-amber-400 mr-2" title={eligibility.missing.join(", ")}>
    {t("course.needs")} {eligibility.missing.join(", ")}{eligibility.moreMissing ? "…" : ""}
  </span>
{/if}
```

- [ ] **Step 4: ✓ toggle button** — in the right-side button column (the
flex-col with ⚠/doc/+/− buttons), add before the ⚠ link:

```svelte
<button
  type="button"
  title={isCompleted(course.code.split(".")[0].replace(/\s+/g, "")) ? t("course.markNotTaken") : t("course.markTaken")}
  class="self-center mr-0 mt-2 sm:mr-2 sm:mt-0 text-xs cursor-pointer {isCompleted(course.code.split(".")[0].replace(/\s+/g, "")) ? 'text-green-600 dark:text-green-400' : 'text-zinc-400 hover:text-green-600 dark:text-zinc-500 dark:hover:text-green-400'}"
  onclick={() => toggleCompleted(course.code.split(".")[0].replace(/\s+/g, ""))}
>
  ✓
</button>
```

- [ ] **Step 5: Verify**

Run: `npx svelte-check --tsconfig ./tsconfig.app.json && npm run build`
Expected: 0 errors, build success.

- [ ] **Step 6: Headless browser smoke** — dev server: toggle a course ✓ →
badge "✓ Taken" appears on that course and "Eligible" appears on its
dependents; reload page → state persists (localStorage).

- [ ] **Step 7: Commit**

```bash
git add src/lib/Course.svelte src/lib/globalState.svelte.ts src/lib/i18n.svelte.ts
git commit -m "feat(eligibility): taken/eligible/needs badges with row toggle"
```

### Task 4: Roadmap logic module (B core)

**Files:**
- Create: `src/lib/roadmapLogic.mjs`
- Create: `src/lib/roadmapLogic.ts` (re-export + types)
- Test: `tools/lib/test/roadmap.test.mjs`

**Interfaces:**
- Consumes: same prereqs-map shape as Task 1.
- Produces:
  - `export function checkRoadmapPrereqs(roadmap, orderedTerms, completed, prereqs)` → `Record<string, Record<string, { ok: boolean, missing: string[] }>>` — per term, per course: is each prereq satisfied by completed ∪ all courses in EARLIER terms (index order of orderedTerms)? Dangling refs ignored (same rule).
  - `export function termCredits(semesterKey, roadmap, termData)` → number — sum of `credits` for roadmap courses found in the term data file (courses not found count 0).
  - `export function sortTermsNewestFirst(terms)` → string[] — "YYYY/YYYY-T" descending.

- [ ] **Step 1: Write the failing tests**

```js
// tools/lib/test/roadmap.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { checkRoadmapPrereqs, termCredits, sortTermsNewestFirst } from "../../src/lib/roadmapLogic.mjs";

const prereqs = {
  CMPE210: { prereqs: ["CMPE150"] },
  CMPE300: { prereqs: ["CMPE210"] },
  DANGLING: { prereqs: ["GHOST101"] },
};

test("prereq satisfied by an earlier roadmap term", () => {
  const roadmap = { "2026-2027-1": ["CMPE150"], "2026-2027-2": ["CMPE210"] };
  const r = checkRoadmapPrereqs(roadmap, ["2026-2027-1", "2026-2027-2"], new Set(), prereqs);
  assert.equal(r["2026-2027-2"]["CMPE210"].ok, true);
});

test("prereq unmet when taught in the SAME term or later", () => {
  const roadmap = { "2026-2027-1": ["CMPE210"], "2026-2027-2": ["CMPE150"] };
  const r = checkRoadmapPrereqs(roadmap, ["2026-2027-1", "2026-2027-2"], new Set(), prereqs);
  assert.equal(r["2026-2027-1"]["CMPE210"].ok, false);
  assert.deepEqual(r["2026-2027-1"]["CMPE210"].missing, ["CMPE150"]);
});

test("prereq satisfied by completed set (feature A)", () => {
  const roadmap = { "2026-2027-2": ["CMPE210"] };
  const r = checkRoadmapPrereqs(roadmap, ["2026-2027-2"], new Set(["CMPE150"]), prereqs);
  assert.equal(r["2026-2027-2"]["CMPE210"].ok, true);
});

test("dangling prereq references are ignored", () => {
  const roadmap = { "2026-2027-1": ["DANGLING"] };
  const r = checkRoadmapPrereqs(roadmap, ["2026-2027-1"], new Set(), prereqs);
  assert.equal(r["2026-2027-1"]["DANGLING"].ok, true);
});

test("termCredits sums credits from term data", () => {
  const termData = { "CMPE150.01": { credits: "3" }, "MATH101.01": { credits: "4" } };
  assert.equal(termCredits("2026-2027-1", { "2026-2027-1": ["CMPE150", "MATH101"] }, termData), 7);
});

test("termCredits counts unknown courses as 0", () => {
  assert.equal(termCredits("t", { t: ["NOPE101"] }, {}), 0);
});

test("sortTermsNewestFirst orders YYYY/YYYY-T descending", () => {
  assert.deepEqual(
    sortTermsNewestFirst(["2024/2025-1", "2026/2027-1", "2025/2026-2"]),
    ["2026/2027-1", "2025/2026-2", "2024/2025-1"],
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tools/lib/test/roadmap.test.mjs`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/lib/roadmapLogic.mjs`**

```js
/**
 * Pure roadmap logic: cross-term prerequisite checking and credit totals.
 * Terms are ordered oldest-first in `orderedTerms`; a prerequisite counts as
 * satisfied if it is in `completed` OR taught in any EARLIER roadmap term.
 * Dangling prereq references are ignored (spec decision).
 */

/**
 * @param {Record<string, string[]>} roadmap
 * @param {string[]} orderedTerms oldest-first
 * @param {Set<string>} completed
 * @param {Record<string, { prereqs: string[] }>} prereqs
 */
export function checkRoadmapPrereqs(roadmap, orderedTerms, completed, prereqs) {
  const result = {};
  const seen = new Set(completed);
  for (const term of orderedTerms) {
    result[term] = {};
    for (const code of roadmap[term] || []) {
      const entry = prereqs[code];
      if (!entry) {
        result[term][code] = { ok: true, missing: [] };
        continue;
      }
      const missing = (entry.prereqs || []).filter(
        (p) => !seen.has(p) && p in prereqs,
      );
      result[term][code] = { ok: missing.length === 0, missing };
    }
    for (const code of roadmap[term] || []) seen.add(code);
  }
  return result;
}

/**
 * @param {string} semesterKey
 * @param {Record<string, string[]>} roadmap
 * @param {Record<string, any>} termData semester course map keyed by section name
 */
export function termCredits(semesterKey, roadmap, termData) {
  const codeToCredits = {};
  for (const [sectionName, info] of Object.entries(termData)) {
    const base = sectionName.split(".")[0];
    if (info && typeof info.credits !== "undefined" && !(base in codeToCredits)) {
      codeToCredits[base] = Number(info.credits) || 0;
    }
  }
  let total = 0;
  for (const code of roadmap[semesterKey] || []) {
    total += codeToCredits[code] || 0;
  }
  return total;
}

export function sortTermsNewestFirst(terms) {
  return [...terms].sort((a, b) => b.localeCompare(a));
}
```

- [ ] **Step 4: Implement `src/lib/roadmapLogic.ts`** (same re-export pattern as Task 1, types for the three functions)

- [ ] **Step 5: Run tests**

Run: `node --test tools/lib/test/roadmap.test.mjs`
Expected: PASS (7/7)

- [ ] **Step 6: Commit**

```bash
git add src/lib/roadmapLogic.mjs src/lib/roadmapLogic.ts tools/lib/test/roadmap.test.mjs
git commit -m "feat(roadmap): cross-term prerequisite logic with node:test coverage"
```

### Task 5: Roadmap state (B state)

**Files:**
- Modify: `src/lib/globalState.svelte.ts` (append at end)

**Interfaces:**
- Produces: `getRoadmap(): Record<string, string[]>`, `addToRoadmap(semester, code)`, `removeFromRoadmap(semester, code)`, `clearRoadmap()`, `loadRoadmap()` — same localStorage pattern as Task 2 (key `roadmap`, try/catch, reactive `$state`).

- [ ] **Step 1: Implement** (append at end of globalState.svelte.ts)

```ts
// ---- Roadmap (multi-semester planning) ----
const roadmapState = $state<Record<string, string[]>>({});
let roadmapLoaded = false;

function persistRoadmap(): void {
  try {
    localStorage.setItem("roadmap", JSON.stringify(roadmapState));
  } catch {
    // ignore
  }
}

export function loadRoadmap(): void {
  if (roadmapLoaded) return;
  roadmapLoaded = true;
  try {
    const raw = localStorage.getItem("roadmap");
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const [term, codes] of Object.entries(parsed)) {
        roadmapState[term] = codes;
      }
    }
  } catch {
    // corrupt data: start empty
  }
}

export function getRoadmap(): Record<string, string[]> {
  return roadmapState;
}

export function addToRoadmap(semester: string, code: string): void {
  if (!roadmapState[semester]) roadmapState[semester] = [];
  if (!roadmapState[semester].includes(code)) {
    roadmapState[semester].push(code);
    persistRoadmap();
  }
}

export function removeFromRoadmap(semester: string, code: string): void {
  const list = roadmapState[semester];
  if (list) {
    const idx = list.indexOf(code);
    if (idx !== -1) {
      list.splice(idx, 1);
      persistRoadmap();
    }
  }
}

export function clearRoadmap(): void {
  for (const k of Object.keys(roadmapState)) delete roadmapState[k];
  persistRoadmap();
}
```

- [ ] **Step 2: Wire `loadRoadmap()` in App.svelte onMount** (next to loadCompleted)

- [ ] **Step 3: Verify** — `npx svelte-check --tsconfig ./tsconfig.app.json` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/globalState.svelte.ts src/App.svelte
git commit -m "feat(roadmap): roadmap state with localStorage persistence"
```

### Task 6: Roadmap panel UI (B UI)

**Files:**
- Create: `src/lib/Roadmap.svelte`
- Modify: `src/lib/CourseList.svelte` (toggle button + conditional render)
- Modify: `src/lib/i18n.svelte.ts`

**Interfaces:**
- Consumes: `getRoadmap`/`addToRoadmap`/`removeFromRoadmap`/`clearRoadmap` (Task 5), `checkRoadmapPrereqs`/`termCredits`/`sortTermsNewestFirst` (Task 4), `getCompletedCourses` (Task 2), `getPrereqsAll` (Task 3), `semesters.json` via `fetch(${import.meta.env.BASE_URL}data/semesters.json)`, term data via `fetch(${import.meta.env.BASE_URL}data/<key>.json)` (keys like "2026-2027-1" map from "2026/2027-1" by replacing "/" with "-"), `t()`.

- [ ] **Step 1: Add i18n keys**

```ts
"roadmap.title": { en: "Roadmap", tr: "Yol Haritası" },
"roadmap.addCourse": { en: "Add course…", tr: "Ders ekle…" },
"roadmap.prereqUnmet": { en: "Prereq not met before this term", tr: "Ön koşul bu döneme kadar tamamlanmamış" },
"roadmap.prereqOk": { en: "Prerequisites met", tr: "Ön koşullar tamam" },
"roadmap.credits": { en: "credits", tr: "kredi" },
"roadmap.empty": { en: "Add courses to plan this term", tr: "Bu dönem için ders ekleyin" },
"roadmap.fromTerm": { en: "Picking from", tr: "Kaynak dönem" },
"roadmap.clear": { en: "Clear roadmap", tr: "Planı temizle" },
```

- [ ] **Step 2: Implement `Roadmap.svelte`**

Component behavior:
1. onMount: fetch semesters.json → term list in "YYYY/YYYY-T" form. Convert
   to file keys ("2026-2027-1") with `term.replace("/", "-")`. Order: current
   semester first, then remaining terms NEWEST-first (sortTermsNewestFirst),
   excluding terms older than the current one. Show at most 6 upcoming terms.
2. Lazy-load term data per term on first expand/paint: fetch
   `data/<fileKey>.json`; if 404 (unpublished future term), mark the column's
   picker source as the most recent term WITH data and label it
   `t("roadmap.fromTerm") + " " + sourceTerm`.
3. Each column: header (term display "2026/2027 Güz" — replace "-" back to
   "/" and map trailing -1/-2/-3 to Güz/Bahar/Yaz for tr, Fall/Spring/Summer
   for en), credit total (termCredits), course list (code + name from term
   data; amber ⚠ + tooltip `t("roadmap.prereqUnmet")` + missing list when
   `!ok`; green ✓ title when ok), remove ×, and an add-input: text input
   filtering the source term's course list (startsWith on code, case-
   insensitive; show top 8 matches in a dropdown; click adds base code via
   addToRoadmap(term, baseCode)).
4. Header row: title `t("roadmap.title")` + `t("roadmap.clear")` button
   (confirm not needed; clearRoadmap is reversible by re-adding).
5. Prerequisite computation: `$derived` from getRoadmap(), ordered terms
   (current first then chronological), getCompletedCourses(), getPrereqsAll().
6. Styling: match existing dark-mode Tailwind patterns (zinc palette, same
   card styles as Course rows); horizontal scroll container
   `flex gap-3 overflow-x-auto`.

- [ ] **Step 3: Wire into CourseList.svelte** — add a "Roadmap" toggle button
next to Copy Link (same small-button style) toggling local `showRoadmap`
state; when true render `<Roadmap />` instead of the courses list block
(keep the CalendarExport footer block visible).

- [ ] **Step 4: Verify**

Run: `npx svelte-check --tsconfig ./tsconfig.app.json && npm run build`
Expected: 0 errors, build success.

- [ ] **Step 5: Headless browser smoke** — open Roadmap, add CMPE150 to
current term and CMPE210 to the next term: CMPE210 shows ✓ (prereq in
earlier term). Remove CMPE150 → CMPE210 flips to amber ⚠ with missing
"CMPE150". Reload → roadmap persists.

- [ ] **Step 6: Commit**

```bash
git add src/lib/Roadmap.svelte src/lib/CourseList.svelte src/lib/i18n.svelte.ts
git commit -m "feat(roadmap): multi-semester roadmap panel with cross-term prereq flags"
```

### Task 7: Final verification

- [ ] **Step 1:** `npm test` → all pass (eligibility + roadmap + existing 40).
- [ ] **Step 2:** `npx svelte-check --tsconfig ./tsconfig.app.json && npx tsc -p tsconfig.node.json` → 0 errors.
- [ ] **Step 3:** `npm run build` → success.
- [ ] **Step 4:** Full headless-browser pass: A badges toggle + persist; B roadmap add/remove/flag-flip + persist; EN/TR switch renders new strings; share-link flow unaffected.
- [ ] **Step 5:** Commit any stragglers; push.
