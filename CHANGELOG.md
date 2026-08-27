# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Automated data pipeline.** `tools/scrape.mjs` scrapes every department's
  schedule page from registration.boun.edu.tr daily, validates the result and
  commits `public/data/<term>.json` + `semesters.json`; GitHub Actions rebuilds
  and redeploys the site to Pages. A newly published semester appears within
  24 hours with no manual step.
- **Prerequisites.** `tools/scrape-prereqs.mjs` crawls the registration
  system's official prerequisite check into `public/data/prereqs.json`; every
  course row shows a "Prerequisite:" line.
- **Prerequisite tree.** Expandable graph view of a course's transitive
  prerequisite chain (`PrereqTree.svelte`, `prereqGraph.mjs`).
- **Catalog descriptions.** `tools/scrape-descriptions.mjs` pulls the
  undergraduate catalogue into `public/data/descriptions.json`; descriptions
  are shown on course rows and are searchable.
- **Completed courses and eligibility badges.** Mark a course as taken; every
  row is then labelled Taken / Eligible / Needs: <missing prereqs>. Persisted
  in localStorage.
- **Newly-eligible panel.** Lists the courses that the current set of
  completed courses has just unlocked in the selected term.
- **Multi-semester roadmap.** Plan courses across upcoming terms with
  cross-term prerequisite checking and per-term credit totals
  (`Roadmap.svelte`, `roadmapLogic.mjs`).
- **Conflict-free section solver.** Picks a non-overlapping set of sections
  for the chosen courses.
- **Command palette.** Cmd+K / Ctrl+K fuzzy course search
  (`CommandPalette.svelte`, `paletteSearch.mjs`).
- **Offering-history badges.** Shows in which past terms a course was offered,
  from `public/data/offerings.json` (`termHistory.mjs`).
- **Calendar export.** Download the selected schedule as an `.ics` file or
  push it to Google Calendar, using real semester start/end dates and
  holidays. `tools/scrape-calendar.mjs` keeps
  `public/data/semester-dates.json` in sync with the official academic
  calendar, and the workflow opens an issue when a term is missing dates.
- **Semester date strip.** Timetable header shows the term's teaching window
  and holidays.
- **ECTS load warning** when the selected courses exceed a sane term load.
- **EN/TR interface.** All UI strings go through `src/lib/i18n.svelte.ts`.
- **Share links** encoding the selected sections, plus a data-freshness
  indicator and a "report bad data" button.
- **Colour-coded timetable blocks**, legible in both themes.
- **LAB and P.S. sessions** are listed as separate selectable entries.
- **Tests.** `npm test` runs `node --test tools/lib/test/*.test.mjs` covering
  the scraper parser, semester policy, calendar parsing, eligibility, roadmap,
  palette search and prerequisite graph logic.
- **Pipeline watchdog** workflow: opens an issue if the daily update has had
  no successful run for over a week. Failed runs also open/comment on an
  `automation-failure` issue, and a post-deploy smoke test fetches the index
  and every data JSON.
- MIT License.
- **Live quota and enrolment.** `tools/scrape-quota.mjs` reads
  `quotasearch.asp` — reachable only through a JS link, so the schedule
  table's `Quota` column had always been dropped — into
  `public/data/quota.json`, on its own scheduled workflow. Course rows show
  seats taken, seats left, FULL and over-enrolment, classroom capacity,
  departmental restrictions and surname restrictions, each stamped with the
  snapshot time because the numbers move continuously during registration.
- **Exam information and final-exam clash detection.** The parser now keeps
  the `Course Delivery Method`, `Final Exam Location`, `Exam` and `Sl.`
  columns, and the card warns when two selected sections share a final.
  An unparseable exam cell reports "unknown", never "no clash".
- **Instructor view.** An instructor index built from data already on disk:
  click a name to see that person's sections, with a panel covering a bounded
  window of recent terms. 2032 scraped spellings collapse to 2011 people
  without tripping the Turkish İ/ı case trap; STAFF/TBA placeholders are
  never presented as people.
- **Timetable image export.** Download the grid as a PNG, drawn on a canvas
  with no new dependency and sharing one colour source of truth with the DOM.
- **Offline support.** A hand-written service worker precaches the app shell
  and serves `public/data/*.json` stale-while-revalidate, so the planner works
  in campus dead zones. The web manifest is now a real installable manifest.
- **Roadmap reaches unpublished terms.** Future term keys are synthesised
  instead of being limited to the terms BOUN has already published, and
  offering likelihood is inferred from `offerings.json` history — labelled as
  a prediction, with its confidence and basis spelled out, never as fact.
- **End-to-end tests.** Playwright covers the catalogue, selection, share
  URLs, timetable layout and export, roadmap, palette, quota, instructor view
  and the offline service worker.
- **Initial-payload budget gate.** `npm run payload` observes what the app
  actually fetches on first load and fails above 180 KB gzipped.

### Changed

- Pushes to `main` rebuild and redeploy the site; the scrape itself now runs
  only on the daily cron and on manual dispatch, so a commit no longer fires
  ~60 requests at the university server.
- Every workflow job has a `timeout-minutes` bound.
- Recovered the 2025/2026-2 semester from legacy local data.
- Course rows distinguish "no prerequisite data for this course" from a
  verified "Eligible". `prereqs.json` gained a `meta` block recording which
  courses were really crawled, so the 314 courses of this term that were never
  fetched are no longer reported as eligible.
- `descriptions.json` (238 KB gzipped, 64% of the old first load) is no longer
  fetched eagerly; it loads on demand behind the description panel and the
  search fallback. Initial load dropped from ~379 KB to 131.8 KB gzipped.
- Overlapping timetable courses sit side by side in sub-columns at constant
  row height instead of stacking and inflating the row.
- The command palette shows each section's number, meeting times and free
  seats; sibling sections of one course used to be indistinguishable.
- The URL is now two-way: the selected term and sections are mirrored into the
  address bar, Back undoes an edit, and share parameters are consumed once and
  scrubbed.
- The conflict-free solver has a trial budget and reports a search that gave up
  distinctly from a proven impossibility, instead of claiming both are "no
  combination exists".
- Logic modules follow the `.mjs` + typed `.ts` re-export convention
  throughout; `solver.ts` was the last holdout and had no tests.

### Fixed

- Cmd+K toggled the palette twice because of a duplicate `document` keydown
  listener.
- Timetable course colours were unreadable in dark mode.
- The `.ics` download button had been dropped by an earlier edit; the
  6-course cap on Google Calendar export was removed.
- The Google Calendar button is hidden when export is not possible.
- The `--semester` workflow-dispatch input was interpolated straight into a
  shell command; it is now passed through `env` and quoted.
- Searching for `C++` or `((` crashed the catalogue: search tokens were
  spliced raw into a `RegExp` inside a derived. Tokens are now escaped, which
  also makes `F.YILMAZ` match a literal dot rather than any character.
- A share link carrying `?c=` but no `?d=` silently dropped the whole
  selection, because the term was read at module-init time when it was still
  empty. This was also the project's only build warning.
- The timetable clipped its rightmost day column at phone widths: the table
  was pinned to the container width, so the scroll container never engaged.
- The prefilled "report bad data" issue was written in Turkish regardless of
  the interface language, and `calendar.tooltipNoDates` shipped Turkish text in
  its English slot.
- Calendar export explains itself when term dates cannot be loaded instead of
  leaving a dead button.

### Removed

- The stale root-level `data/` directory (9.6 MB, superseded by
  `public/data/`; nothing referenced it).

## [1.2.0] - 2025-09-06

### Added

- New course data

### Changes

- Update dependencies
- Fix selected course save by changning trigger from beforunload to visibilitychange
- Handle corrupted localstorage

## [1.1.0] - 2022-04-04

### Added

- Course categories as badges below search bar

### Changes

- Update dependencies

## [1.0.2] - 2022-02-05

### Changes

- Update dependencies
- Migrate from Tailwind CSS 2 to 3

## [1.0.1] - 2022-02-05

### Added

- New course data

### Fixed

- Fix bug related to removed courses
- Fix Google Analytics

## [1.0.0] - 2021-10-23

### Added

- Dark theme.

### Changed

- Migrate from Vue to Svelte and from Bootstrap-Vue to Tailwind CSS.
- Change timetable from an auto layout to a fixed layout.

### Fixed

- Fix course detail overflow bug on small screens.

## [0.2.0] - 2020-06-28

### Changed

- Divide the monolithic code in App.vue into components to make it more readable.
- Change course data format. The labs and p.s. are no longer inside their parent course.

### Fixed

- Fix the problem where the course descriptions open wrong link. The reason was some course codes did contain a whitespace and some did not and I was removing the whitespace to make them uniform.
- Fix the problem where the keyboard did not close upon pressing return on mobile.
- The search bar should now not be autocorrected on mobile.

### Removed

- Remove the debounce that was applied to search bar and course hover actions. It only made the UI slow. It did not improved the performance much.

## [0.1.0] - 2019-02-17

### Added

- Add a badge for conflicting courses.

### Changed

- Migrate from React to Vue

## [0.0.0] - 2018-09-11

### Added

- Course search.
- Timetable of selected courses.
- Display individual and total credit of selected courses.

[unreleased]: https://github.com/kilicbaran/boun-course-planner/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/kilicbaran/boun-course-planner/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/kilicbaran/boun-course-planner/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/kilicbaran/boun-course-planner/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/kilicbaran/boun-course-planner/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/kilicbaran/boun-course-planner/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/kilicbaran/boun-course-planner/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/kilicbaran/boun-course-planner/releases/tag/v0.1.0
