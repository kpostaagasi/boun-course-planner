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

- Course search
- Supports Lab and PS hours
- Shows all the necessary info about courses
- Shows individual and total credits of selected courses

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
