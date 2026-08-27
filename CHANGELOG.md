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

### Changed

- Pushes to `main` rebuild and redeploy the site; the scrape itself now runs
  only on the daily cron and on manual dispatch, so a commit no longer fires
  ~60 requests at the university server.
- Every workflow job has a `timeout-minutes` bound.
- Recovered the 2025/2026-2 semester from legacy local data.

### Fixed

- Cmd+K toggled the palette twice because of a duplicate `document` keydown
  listener.
- Timetable course colours were unreadable in dark mode.
- The `.ics` download button had been dropped by an earlier edit; the
  6-course cap on Google Calendar export was removed.
- The Google Calendar button is hidden when export is not possible.
- The `--semester` workflow-dispatch input was interpolated straight into a
  shell command; it is now passed through `env` and quoted.

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
