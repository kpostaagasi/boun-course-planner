# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Boğaziçi University students building a course schedule. Two peak moments are
weighted equally and both must be fully served:

1. **Calm planning**, before registration opens — comparing sections,
   checking prerequisites, judging credit and ECTS load.
2. **Registration week / add-drop**, under time pressure — quotas moving
   continuously, sections filling, decisions made in seconds on whatever
   device is at hand.

Undergraduates are the core audience. Graduate and exchange students are not
a separate design target (undecided; not confirmed as a distinct persona).

## Product Purpose

Turn Boğaziçi's official course schedule into a plan a student can trust:
search the catalogue, select sections (including LAB and P.S. as separate
entries), see a clash-free colour-coded timetable, and export or share it.
Success is a student leaving with a conflict-free, prerequisite-valid,
quota-aware schedule they can act on in the registration system.

## Positioning

Framed first against the **official registration system**
(registration.boun.edu.tr): the app never replaces it as source of truth, it
makes its data usable — conflict detection, timetable view, prerequisite
chains, quota with snapshot time. It must also beat
other third-party BOUN planners (freshness, prerequisites, quota)
and the manual fallback students otherwise use: spreadsheets, notes and
group-chat screenshots.

The defensible mechanism is the automated pipeline: a daily scrape of every
department's schedule page, validated before it is allowed to overwrite
anything, deployed within 24 hours of a semester being published — plus a
15-year archive of past terms that powers offering history and instructor
history.

## Operating Context

- The registration system is the authority; students cross-check it and
  ultimately register there. Numbers on this site can lag it.
- Quota and enrolment change continuously during registration; every number
  is stamped with its snapshot time.
- Terms are identified as `YYYY/YYYY-N` (e.g. `2026/2027-1`); N=3 is a short
  summer term with a much smaller catalogue.
- Semester start/end dates and official holidays come from the academic
  calendar and drive `.ics` / Google Calendar export.
- Course selections and completed courses live in `localStorage`; share
  links encode the selected sections in the URL.
- Usage is bilingual (Turkish campus, English-language instruction) and
  frequently mobile, sometimes on poor connectivity.

## Capabilities and Constraints

Confirmed capabilities (see README for the full list): catalogue search
(code → name → instructor → description) with day/hour/category filters,
Cmd/Ctrl+K command palette, conflict-free section solver, prerequisite tree
with transitive chain, Taken/Eligible/"Needs: …" state from completed
courses, offering and instructor history across archived terms, live quota and
enrolment with restrictions, final-exam dates with conflict warning, `.ics`
and Google Calendar export, timetable PNG, share links, EN/TR, dark mode,
freshness indicator, report-bad-data.

Binding constraints — future work must not break these:

- **Static, no backend, no login.** Vite + Svelte 5 (runes) + Tailwind 4 +
  TypeScript on GitHub Pages; all data is JSON under `public/data/`. No
  accounts, no server-side state, no personal data leaves the device.
- **Unaffiliated, official source linked.** The "no affiliation with
  Boğaziçi University" disclaimer stays, and the registration system stays
  linked as the source of truth.
- **Full EN/TR parity.** Every string exists in both languages
  (`src/lib/i18nDict.mjs`); no English-only surface.
- **Offline / installable PWA.** Service worker caching and installability
  keep working.
- **Never invent data.** Missing quota, prerequisite, exam or description
  data says so; it never renders a plausible zero or an empty state that
  reads as fact.

Technical constraints that shape the work: pure logic lives in `.mjs` with a
`.ts` type sidecar so `node --test` can exercise it build-free; state is
module-level runes in `src/lib/globalState.svelte.ts`, never Svelte stores;
`descriptions.json` (~1 MB) is loaded on demand only; payload budget is
tracked by `tools/measure-payload.mjs`.

## Brand Commitments

- Name: **BOUN Course Planner** / **BOUN Ders Planlayıcı**; short name
  "BOUN Planner".
- Existing icon set, `safari-pinned-tab.svg`, and
  `public/social-media-image.png` (1200×630 OG image).
- Voice: plain, factual, student-to-student, no marketing tone. Warmth is
  allowed in the small places it already lives ("Good luck in the new
  semester!" / "Yeni dönemde başarılar!"), never in functional copy.
- Honesty about data limits is part of the voice: say what is stale,
  unknown, or possibly behind the registration system.

## Evidence on Hand

- Real scraped data for the current term plus archived terms back to
  2017/2018 in `public/data/` (`<YYYY-YYYY>-<n>.json`, `semesters.json`,
  `meta.json`, `offerings.json`, `prereqs.json`, `descriptions.json`,
  `quota.json`, `semester-dates.json`).
- Live pipeline: `.github/workflows/update-data.yml` (daily 05:00 UTC) and
  the scrapers under `tools/`.
- Playwright e2e suite in `e2e/` (smoke, timetable, courselist, palette,
  quota, instructor, urlstate, pwa, a11y) and unit tests in
  `tools/lib/test/`.
- No testimonials, user counts, install numbers, endorsements, ratings or
  university approval exist. Future work must not fabricate any of these,
  and must not imply official status.

## Product Principles

1. **The official system is the authority; we are the interface.** Make its
   data usable, never overwrite its truth or hide that it can differ.
2. **Serve the calm planner and the panicking registrant with one screen.**
   Depth for planning, speed and legibility under pressure.
3. **Unknown is a first-class value.** Absent data is labelled, timestamped
   or explained, never smoothed into a number.
4. **Nothing to install, nothing to sign into, nothing to lose.** Static,
   local, shareable by URL, usable offline.
5. **Both languages, one product.** Turkish is not a translation layer bolted
   onto English.

## Accessibility & Inclusion

- Machine gate already in place (`e2e/a11y.spec.ts`): zero serious and zero
  critical axe-core violations across the five interactive surfaces in both
  light and dark schemes — this covers WCAG contrast, so palette changes are
  checked by it.
- Modal dialogs must trap focus; the app is keyboard-operable, including the
  Cmd/Ctrl+K palette.
- Colour is never the only carrier of meaning (conflicts, FULL quota,
  eligibility state also carry text or icon).
- Mobile and small-viewport use is a primary case, not a fallback.
