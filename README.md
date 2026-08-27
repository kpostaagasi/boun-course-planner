# BOUN Course Planner

Course schedule planning tool for Boğaziçi University

Automated course-schedule pipeline for Boğaziçi University. Data is scraped
from [registration.boun.edu.tr](https://registration.boun.edu.tr) and deployed
to GitHub Pages without manual intervention — a newly published semester
appears on the site within 24 hours.

## How data stays fresh

```
registration.boun.edu.tr ──daily cron──▶ tools/scrape.mjs ──▶ public/data/*.json
                                                                     │
                                              changed? ──yes──▶ build + deploy (GitHub Pages)
                                                     └──no──▶ nothing happens
```

The [`update-data` workflow](.github/workflows/update-data.yml) runs daily at
05:00 UTC:

1. **Discover** — probes candidate term codes and finds the semester that is
   newly published or currently in its teaching window.
2. **Scrape** — fetches every department's schedule page (~60 requests) for
   that one semester and parses courses, PS/LAB sessions, rooms and hours.
3. **Validate** — the run is aborted unless every page was fetched, parse
   warnings stay under a threshold, section counts look sane, and the result
   does not shrink suspiciously versus the stored file.
4. **Commit + deploy** — writes `public/data/<YYYY-YYYY>-<term>.json`, updates
   `semesters.json`, commits, rebuilds the site with Vite and deploys to
   GitHub Pages. Unchanged data triggers no commit and no deploy.

### Failure handling

- Writes happen only after validation passes: a failed scrape always leaves
  the previous data (and deployed site) intact — never empty or broken output.
- A failed run opens/comments on a GitHub issue labelled `automation-failure`
  with a link to the logs.
- The parser reads column positions from the table header row; if BOUN changes
  their HTML layout, scraping fails loudly instead of silently producing junk.

### One-time setup

Repository → Settings → Pages → **Source: GitHub Actions**.

To force an immediate update for a specific semester, run the *Update course
data* workflow manually ("Run workflow") with e.g. `2026/2027-1`.

### Local scrape

```sh
npm install
npm run scrape                # auto-detect the current semester
npm run scrape -- --dry-run   # validate without writing
npm run scrape -- --semester 2026/2027-1
npm run scrape -- --allow-partial --semester 2025/2026-2
```

`--allow-partial` (only valid together with `--semester`) is for recovering
archived terms whose pages are partially broken on the server side: it
retries failed departments once after a cool-down, then proceeds if at least
95% of departments succeeded — loudly logging which departments are missing.
It never applies to the auto-synced current semester.


### Prerequisites

Course prerequisites come from the registration system's official
prerequisite check (`prerequisitecheck.asp`) and power the
"Prerequisite:" line on each course. The full crawl covers ~2000+ courses
and is throttled, so it runs manually:

```sh
node tools/scrape-prereqs.mjs --resume   # continues where it left off
```

or via the *Scrape prerequisites* workflow (manual dispatch). Output lands
in `public/data/prereqs.json`; `--resume` skips courses already present.
The daily schedule pipeline does not touch this file.

### Manual data

`public/data/semester-dates.json` (semester start/end dates and holidays,
used by the calendar export) comes from the academic calendar and is not
scraped automatically. The scraper prints a reminder when a new semester is
missing an entry there.

## Features

**Search and browse**

- Course search that matches the code first, then falls back to course name,
  instructor and finally the catalogue description text.
- Category badges and day/hour filters for narrowing the catalogue.
- Cmd+K / Ctrl+K command palette, showing each result's section number,
  meeting times and free seats so sibling sections are told apart.
- LAB and P.S. sessions are listed as separate, individually selectable
  entries.
- Official catalogue descriptions shown on each course, loaded on demand.
- Instructor view: click a name to filter the catalogue to that person's
  sections, or open a panel covering a window of recent terms.

**Planning**

- Colour-coded timetable of the selected sections, with individual and total
  credits and an ECTS load warning.
- Conflict-free section solver: picks a non-overlapping set of sections for
  the courses you want.
- Prerequisites on every course, with an expandable tree of the transitive
  prerequisite chain.
- Mark courses as taken → Taken / Eligible / "Needs: …" badges on every row,
  plus a panel listing the courses your completed set has just unlocked.
- Multi-semester roadmap: plan future terms with cross-term prerequisite
  checking and per-term credit totals.
- Offering history: in which past terms a course was actually offered.
- Live quota and enrolment per section: seats taken, seats left, FULL and
  over-enrolment, classroom capacity, departmental and surname restrictions —
  each stamped with the snapshot time, because the numbers move continuously
  during registration. A section we have no data for says so rather than
  showing a zero.
- Final exam date, session and location where the registration system
  publishes them, with a warning when two selected sections share a final.

**Export and sharing**

- `.ics` download and Google Calendar export using the real semester
  start/end dates and official holidays.
- Semester date/holiday strip above the timetable.
- Share links that encode the selected sections.
- Download the timetable as a PNG.
- Works offline: a service worker caches the app and its data, and the app is
  installable.
- EN/TR interface, dark mode, data-freshness indicator and a "report bad
  data" button.

Selections, completed courses and the roadmap are persisted in
`localStorage`.

## Architecture

Static SPA: Vite + Svelte 5 (runes) + Tailwind 4 + TypeScript, no backend.
Everything the client needs is a JSON file under `public/data/`, served from
the same GitHub Pages origin.

**Pure logic lives in `.mjs`, types live next to it in `.ts`.** Each logic
module is a plain-JS `src/lib/<name>.mjs` holding the pure functions, plus a
thin `src/lib/<name>.ts` that re-exports it and declares the TypeScript types
(`export * from "./<name>.mjs"`). The app imports the `.ts`; the tests import
the `.mjs` directly, so `node --test` can exercise the frontend logic with no
build step and no TS loader. Modules following this pattern: `eligibility`,
`roadmapLogic`, `prereqGraph`, `paletteSearch`, `termHistory`. Tests live in
`tools/lib/test/*.test.mjs`, fixtures in `tools/lib/fixtures/`.

**State is module-level runes, not stores.** `src/lib/globalState.svelte.ts`
owns the app state as module-scope `$state` and exposes plain getter/setter
functions (`getSelectedCourses()`, `toggleCompleted()`, `addToRoadmap()`, …).
There are no Svelte stores anywhere; components import the functions and read
them inside `$derived`.

**What the client fetches, and when.** On mount: `semesters.json` (term list)
and `meta.json` (scrape timestamp for the freshness indicator), then the
selected term's `<YYYY-YYYY>-<n>.json`, plus `prereqs.json`, `offerings.json`
and `descriptions.json` in the background. `semester-dates.json` is loaded by
the timetable strip and the calendar export. The roadmap lazily fetches
additional term files as columns are opened. Every fetch is
`${import.meta.env.BASE_URL}data/<file>.json`.

**Scrapers** are four independent Node entry points under `tools/`, all
sharing `tools/lib/http.mjs` (retry, throttle, ISO-8859-9 decoding) and all
writing to `public/data/`:

| Entry point | Output | Trigger |
| --- | --- | --- |
| `tools/scrape.mjs` | `<term>.json`, `semesters.json`, `meta.json`, `offerings.json` | daily cron |
| `tools/scrape-prereqs.mjs` | `prereqs.json` | manual |
| `tools/scrape-descriptions.mjs` | `descriptions.json` | manual |
| `tools/scrape-calendar.mjs` | `semester-dates.json` | daily cron |

## Built With

- Vite
- Svelte
- Tailwind CSS

### Project Scaffolding

This project is scaffolded with these commands:

```sh
npm create vite@latest
# choose svelte, cd into project directory
npm install
```

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/kilicbaran/boun-course-planner.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Start up a development server
   ```sh
   npm run dev -- --open
   ```
