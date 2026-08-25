# Completed-Courses Eligibility Badges (A) + Multi-Semester Roadmap (B) — Design

**Date:** 2026-08-25
**Status:** Approved (user selected: simple badges + row ✓ toggle for A; roadmap panel + semester-data course picker for B)

## Feature A: "Which courses can I take?" eligibility badges

### Purpose

Students mark courses they have completed; every course row then shows
whether it is taken, eligible (all prerequisites met), or blocked (with the
missing prerequisites listed). This turns the planner from a schedule viewer
into a personal advisor and puts the prereqs.json investment to work.

### Data model

- `completedCourses: Set<string>` of base course codes ("CMPE150"), semester-
  independent. Persisted in `localStorage` under key `completedCourses` as a
  JSON array. Lives in `globalState.svelte.ts` with `$state`, following the
  existing `selectedCourseNamesAll` pattern.
- API: `toggleCompleted(code: string)`, `isCompleted(code: string): boolean`,
  `getCompletedCourses(): string[]`.

### Eligibility logic

New pure module `src/lib/eligibility.ts` (kept out of globalState for
testability):

```ts
export type Eligibility = "taken" | "eligible" | "missing-prereq" | "no-data";

export function getEligibility(
  baseCode: string,
  completed: Set<string>,
  prereqs: Record<string, { prereqs: string[] }> | null,
): Eligibility
```

- `taken` — code is in the completed set.
- `no-data` — `prereqs` is null or has no entry for the code (badge hidden).
- `eligible` — every entry of `prereqs[code].prereqs` is in `completed`.
  Dangling references (e.g. SOC101/SOC108, absent from prereqs.json) are
  IGNORED, not blocking: only 2 of 1066 references; blocking on them would
  produce false "missing" badges.
- `missing-prereq` — at least one prerequisite is not completed. The badge
  lists the missing ones (max 3 shown, "+N more" if longer).
- Consent/GPA requirements do NOT participate in eligibility; they remain
  informational lines.

### UI (Course.svelte)

- A small ✓ toggle button on each course row (left of the existing +/−
  buttons): toggles completion. Visual state when completed (filled/green).
- Badge next to the course title:
  - `✓ Taken` (green) when taken
  - `Eligible` (subtle gray) when eligible
  - `Needs: X, Y, Z` (amber, lists missing prerequisites) when missing-prereq
  - nothing when no-data
- Reactivity: eligibility derives from the completed set; toggling any
  course updates all badges.

### i18n

New keys in `src/lib/i18n.svelte.ts`: `course.taken` (Taken / Alındı),
`course.eligible` (Eligible / Alınabilir), `course.needs` (Needs: / Gerekli:),
`course.markTaken` / `course.markNotTaken` (button titles).

### Testing

`src/lib/eligibility.test.mjs` using `node:test` (repo convention): taken,
eligible, missing-prereq (with listing), dangling-reference-ignored, no-data,
null-prereqs. UI verified via headless browser smoke (toggle → badge updates).

## Feature B: Multi-semester Roadmap panel

### Purpose

Let students plan across semesters: assign courses to future terms (fall/
spring/summer), see at a glance which planned courses have unmet
prerequisites given what comes before them in the plan (plus completed
courses from Feature A).

### Data model

- `roadmap: Record<string, string[]>` — semester key ("2026-2027-2") →
  selected base-or-section course codes. Persisted in `localStorage` under
  key `roadmap`.
- API in `globalState.svelte.ts`: `getRoadmap()`, `addToRoadmap(semester,
  code)`, `removeFromRoadmap(semester, code)`, `clearRoadmap()`.
- Semester list for the panel: existing `public/data/semesters.json` (25
  terms, 2017→now) — panel shows the CURRENT semester first, then later
  terms as they become available in semesters.json. Terms without published
  data start empty and accept manual picks only from terms that DO have
  data (see course source below).

### Course source

Courses are picked from semester data files (existing
`public/data/<semester>.json`), so instructor/schedule info is shown in the
picker. The picker for a roadmap term uses that term's data file if it
exists; for future unpublished terms, the picker falls back to the most
recent term's catalogue (codes are stable across terms) and labels the
source term in the picker header.

### Roadmap panel UI (new `src/lib/Roadmap.svelte`)

- Horizontal scroll of semester columns; current semester first.
- Each column: term header (e.g. "2026-2027 Güz"), list of assigned courses
  (base code + name from the source term data), remove ×, and an "add"
  search box reusing the existing search-input pattern.
- Prerequisite check across the plan: a course in term T is flagged amber
  ("prereq not met before this term") if any prerequisite is not in
  (completed ∪ all terms before T). Green check if satisfied. Uses the same
  dangling-reference-ignored rule as A.
- Column-level credit total (from the source term data credits field).
- Entry point: a "Roadmap" toggle button in the Courses panel header next to
  Copy Link; panel replaces the course list area when open (same layout
  pattern as the filter dialog).

### i18n

Keys: `roadmap.title` (Roadmap / Yol Haritası), `roadmap.addCourse`,
`roadmap.prereqUnmet` (Prereq not met before this term / Ön koşul bu döneme
kadar tamamlanmamış), `roadmap.prereqOk`, `roadmap.credits`, `roadmap.empty`
(Add courses to plan this term / Bu dönem için ders ekleyin), `roadmap.fromTerm`
(picker source label).

### Testing

`src/lib/roadmap.test.mjs` (node:test, pure logic extracted to
`src/lib/roadmapLogic.ts`): prerequisite-across-terms check (met/unmet/
dangling-ignored), credit totals, term ordering. UI via headless browser
smoke: add course to a term, see flag flip when prerequisite added to an
earlier term.

## Cross-feature interaction

- A's completed set feeds B's prerequisite check (completed ∪ earlier plan
  terms).
- Toggling a course "taken" in A does NOT auto-move it in the roadmap;
  the two are independent lists.
- Both persist independently in localStorage.

## Non-goals (YAGNI)

- No automatic schedule generation across terms (solver stays single-term).
- No server sync; localStorage only.
- No drag-and-drop in v1; add/remove via buttons.
