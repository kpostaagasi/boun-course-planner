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
  the scraper parser, semester policy, calendar parsing, eligibility, term
  ordering, palette search and prerequisite graph logic.
- **CI workflow.** `.github/workflows/ci.yml` runs type-checking, unit tests,
  the production build, the initial-payload budget and the full Playwright
  suite on every pull request and on `main` after a merge. Until now no
  workflow ran on a pull request at all: the first real execution of a change
  was the deploy that `update-data.yml` performs on push to main, by which
  point it was already live.
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
- **End-to-end tests.** Playwright covers the catalogue, selection, share
  URLs, timetable layout and export, palette, quota, instructor view and the
  offline service worker.
- **Initial-payload budget gate.** `npm run payload` observes what the app
  actually fetches on first load and fails above 180 KB gzipped.
- **Catalogue empty state.** A search that matches nothing now names the query,
  states the search order (code → name → instructor → description) and offers
  the two ways out — clear the query, reset the time filter — instead of
  rendering an empty box. While the description fallback is still fetching it
  reports as searching rather than as "no matches".
- **Tap-to-read explanations on the course card.** The eligibility mark, the
  "prereqs unchecked" mark, the enrolment snapshot stamp and the quota note are
  disclosure buttons that write their sentence into one annotation slot on the
  card, so the explanations reach touch and screen-reader users who never see a
  `title` tooltip.
- **Clear button in the search field**, so getting back to the browse view no
  longer means deleting the query by hand.

### Changed

- Start-up deletes the `roadmap` key a removed feature left in `localStorage`,
  so a browser that used a version which had it does not carry its data around
  forever. The prune is a named list, not a sweep — keys still in use are
  untouched — and it is where any future removed feature's storage goes.
- **"Sade" visual identity.** The interface was rebuilt around what a student
  needs in the two seconds before they click Add: a soft neutral ground with
  white cards, one calm accent for interaction, soft corners (8px controls,
  12px cards, 18px dialogs), and whitespace instead of rules and boxes. Green,
  amber and red are still reserved for seats, filling and clashes, and are
  desaturated a step so a hundred rows no longer read as a traffic light.
  Section labels dropped the all-caps mono eyebrow for sentence-case text, and
  the secondary-button vocabulary collapsed to three global classes
  (`.btn-primary`, `.btn-quiet`, `.btn-text`) plus one `.card` template. The
  PNG export palette was resynchronised with the new tokens.
- **Course rows fold.** A catalogue row now shows identity, instructor,
  schedule, rooms, credits, seats and any live alert — and one 44px Add /
  Remove button. Exam schedule, prerequisites and their tree, quota
  restrictions, cross-listings, offering history, ECTS, the catalogue
  description and the three secondary actions (mark as taken, official course
  page, report incorrect data) moved into a per-row `Details` disclosure,
  where they are labelled buttons rather than bare icons. Nothing was removed;
  a row went from up to eleven stacked reference lines and four repeating icon
  buttons to five lines and one button.
- The top bar is a single hairline: title, term, language. The Oxford double
  rule and the masthead treatment are gone, and the EN/TR control carries
  `aria-pressed` so the active language is exposed to assistive tech rather
  than only to the eye. Header controls compact below `sm` so the app title
  never truncates on a 390px phone.
- The department fold's "show more" toggle sits beside the chip row instead of
  floating over it, where it covered the very chips it was offering to reveal.
- **"Boğaz Editorial" visual identity.** The interface now reads like the
  document it replaces: paper-white ground, one cool ink-grey ramp, cobalt as
  the single interaction ink, hairline rules instead of shadows, and corner
  radii collapsed to 1–4px through the theme tokens. The masthead is set like
  a letterhead and closed with an Oxford rule. Schibsted Grotesk (self-hosted,
  latin + latin-ext) replaces Archivo; IBM Plex Mono still marks machine data.
  Timetable blocks became ledger lines — near-white `-50` fill under a firm
  3px `-600` ink rule — and the PNG export palette was resynchronised with the
  rendered colours, including the red/amber/blue families that `app.css`
  remaps. Service-worker cache bumped to v3 for the new font files.
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
- **Quota staleness is judged against the registration window**, not a flat 24
  hours: enrolment only moves in the weeks around the first day of classes, so
  the amber "as of" stamp used to fire on every row for months at a stretch and
  meant nothing by the week it mattered. Off-season the threshold is a week,
  which still catches a scrape that stopped (`quotaIsStale`).
- **The quota note says whose wording it is.** "Consent Of Instructor" is on
  99.4% of this term's sections before registration opens, mandatory first-year
  courses included; read raw it says "email this professor" rather than "no
  quota published yet".
- **Card actions are 44 px touch targets** in a 2×2 block below `sm`, relaxing
  to a 36 px row above it. Mark-as-taken and report-bad-data were 10×16 and
  14×16 CSS px on a phone and had no accessible name.
- **"Taken" is cobalt in both places it appears.** The manual toggle rendered
  the same fact in scarcity-green, which is the ramp reserved for seats; the
  report-issue hover moved off red for the same reason. The bare `✓` glyph
  became a drawn icon (`IconCheck`).
- **The description toggle is reachable while browsing.** It only appeared once
  `descriptions.json` had been fetched, and the only thing that fetched it was
  the zero-match search fallback; the first click now loads the catalogue and a
  course with no entry says so.
- **The department chip rail ships collapsed.** The fold exists so 84 chips are
  not the first decision of a session; it was defaulting to open.
- `semester-dates.json` is fetched once by `globalState` instead of separately
  by the timetable and the calendar export.

### Fixed

- **The palette shortcut covered a catalogue row's Add button.** It was a
  `fixed` button in the bottom-right corner — the corner where every row keeps
  its Add button. Measured on the deployed site it covered 67% of one at 360px
  and 48% on the desktop, and a tap at that button's centre reached the
  shortcut instead. A fixed overlay above a scrolling list collides with
  whichever row is beneath it, so it is docked beside the search field now,
  where it is still reachable without a keyboard and never over a row.
- **Inline text controls were under the 24px touch floor.** `.btn-text` carries
  the minimum itself rather than leaving it to each caller to remember, which
  is how "How to import?" shipped at 18px. The footer's registration link is an
  inline link inside a sentence, so it gets vertical padding instead — a real
  25px hit box with the paragraph rendering identically.
- **The filter dialog's Apply button was off screen on a phone.** It landed at
  y=679 in an iPhone 13's 664px viewport — below the fold, outside the dialog's
  own box, and with nothing to scroll, because the grid's wrapper had no
  bounded height and so never became a scroller. Filters could be set and never
  applied. The dialog is now a bounded flex column (header, scrolling grid,
  pinned Apply), verified at 664, 640 and 560px tall and unchanged on the
  desktop. A regression from the visual redesign, which added ~88px of height
  to a dialog that previously fit; the accessibility spec exercises this dialog
  only on the desktop project, so nothing caught it. An `@mobile` e2e test now
  covers the height-dependent half.

- **The quota crawl aborted on a table BOUN added mid-term.** A "Semester
  Quotas:" block appeared on 2026-09-08 (LAW336, PRED2xx/3xx) and pushed the
  run past its 20-warning budget, so no quota data was written at all. It has
  the class table's shape and now routes through the same reader.
- **Nested quota tables were counted twice.** The site wraps a captioned quota
  table inside a plain layout table, and the wrapper claimed its child's
  caption: every row of a nested table parsed twice, so MIS542.01 shipped a
  class quota of 10 as 20 seats, and 11 unrecognised captions were reported as
  22 warnings — which is what tripped the budget.
- **Class and semester rows no longer masquerade as seat allocations.** They
  are a breakdown of who may take a section, not how its seats are divided, so
  folding them in turned "Semester 1: 0/0" into a section quota of 0 with 0
  enrolled — a fabricated FULL on an open section — and listed semester numbers
  in the card's "Only …" department line. They are stored with a `scope` and
  kept out of both.
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
- Catalogue and selected-course rows are keyed by course, so an expanded
  description or prerequisite tree no longer follows the list position onto an
  unrelated course after a new search.
- The command palette said "Full" where the card said "FULL" for one fact.

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
