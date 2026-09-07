---
target: src/lib/Course.svelte src/lib/CourseCatalogue.svelte
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/kpostaagasi/Documents/GitHub/boun-course-planner/src/lib/Course.svelte"
target_fingerprint: "sha256:16f415b3c67866f2bcb0204b5b881c7e5cbce4ff541bb5fd154191cea45ecde1"
target_path: /Users/kpostaagasi/Documents/GitHub/boun-course-planner/src/lib/Course.svelte
timestamp: 2026-09-07T12-24-10Z
slug: src-lib-course-svelte
---
Method: dual-agent (A: CritiqueA · B: CritiqueB)

**Target:** the course-card + catalogue surface — `src/lib/Course.svelte`, `src/lib/CourseCatalogue.svelte`. Mode: **Operate**. Live term `2026/2027-1`, quota snapshot `2026-09-03T18:56:54Z`, dev server `http://localhost:5173/`.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | A zero-result search renders an empty `role="list"` box — no "no matches" text at all. |
| 2 | Match System / Real World | 3 | `"Consent Of Instructor"` shown verbatim on 3,043 of 3,061 live sections (99.4%), incl. mandatory MATH101/EC101, with no cue separating "real permission gate" from "quota not published yet". |
| 3 | User Control and Freedom | 3 | No clear/`×` on the search input; the only way back to chip-browse is deleting the query by hand. |
| 4 | Consistency and Standards | 2 | "This course is taken" renders in two inks on one card: cobalt `#2447c9` (badge) vs scarcity-green `#2f643a` (toggle) — contradicts DESIGN.md's own One Ink example. |
| 5 | Error Prevention | 2 | Nothing heads off the consent-wording or silent-empty-search misreadings before they form. |
| 6 | Recognition Rather Than Recall | 2 | The 4-icon action cluster carries no visible text; meaning lives in hover `title` only, which never fires on touch. |
| 7 | Flexibility and Efficiency | 2 | No keyboard path to expand a description, open a prereq tree, or add a section without pointing at a small icon. |
| 8 | Aesthetic and Minimalist Design | 2 | Doctrine is genuinely minimal, but worst-case rows stack 6–7 same-weight fragments on one line and the chip rail opens at full 85-item width. |
| 9 | Error Recovery | 2 | "Seats: no data" and "? prereqs unchecked" model absence honestly, but a zero-result search offers no recovery guidance. |
| 10 | Help and Documentation | 2 | Every contextual explanation is a hover-only `title` — unreachable on the mobile surface PRODUCT.md calls "a primary case, not a fallback". |
| **Total** | | **23/40** | **Acceptable (57.5%) — significant improvements needed** |

No heuristic was scored `n/a`; Operate mode applies all ten.

## Design Specificity Verdict

**Authored, with isolated interchangeable patches.**

**LLM assessment (unanchored).** The signature ideas required real domain knowledge and could not be lifted from another product: the occupancy meter's hatched over-enrolment tail (a BOUN-specific answer to "is this section gettable"); the `?` prereqs-unchecked mark whose tooltip states the epistemic claim it refuses to make ("absent ≠ no prerequisites"); the mono/sans split applied without a single exception across every state tested; and an eligibility cascade that is architecturally real — marking `EC101` taken live shrank `AD352`'s amber `Needs:` list in the same render pass, through one shared `completedSet` and a pure `getEligibility()`. Category chips were tuned against BOUN's actual 85-department catalogue, not a stock filter pattern.

Two patches read as dropped in from elsewhere: the green "mark as taken" checkmark (generic todo-app "done!" colour inside a system whose doctrine names cobalt for exactly that fact) and the missing `{#each}` key (an absent line, not a wrong design decision).

**Deterministic scan.** `impeccable detect --json src/lib/Course.svelte src/lib/CourseCatalogue.svelte` → exit 0, **1 advisory finding**: `design-system-font-size` at `CourseCatalogue.svelte:249` (`text-[0.75rem]` on the category chip). **False positive** — DESIGN.md's Components → Chips section documents that exact recipe by name ("mono, 0.75rem/500, Ink Grey 600, no border and no fill"); the rule cross-references only the six frontmatter typography steps and cannot see the prose exception. Dependency scope (`App.svelte`, `CourseList.svelte`, `CommandPalette.svelte`) → exit 0, 0 findings.

The detector's silence on the remapped Tailwind scales was verified, not assumed: `app.css`'s `@theme` block rewrites `zinc`/`gray` → ink-grey, `blue` → cobalt, `red`/`green`/`amber` → the scarcity ramp, so `hover:text-blue-600` **is** the One Ink Rule in force, and the `shadow` at `CourseCatalogue.svelte:163` is DESIGN.md's own named exception.

**Visual overlays: none.** No user-visible overlay exists and none is claimed. `document.title` writes and DOM node insertion succeeded, but script-tag execution was blocked by the automation sandbox across three independent mechanisms (inline `textContent`, `data:` URI `src`, Puppeteer `addScriptTag`) — ruled out as an app cause (no CSP header, no CSP meta). `detect.js` exists only when `impeccable live-server` serves it, which was out of scope. Fallback signal used instead: direct CDP measurement via `getComputedStyle`/`getBoundingClientRect`.

## Overall Impression

This is a disciplined, genuinely authored instrument with a trust bug at its centre. The design doctrine holds up under measurement — all six sampled small-text classes clear AA 4.5:1 in both schemes, the mono/sans split never breaks, the detector finds nothing real. What undercuts it is not taste, it is three failures of *fidelity to state*: a row can display UI state belonging to a different course, a zero-result search says nothing at all, and the two signals meant to convey urgency ("consent required", "this number is stale") currently fire on effectively every row, all the time.

The single biggest opportunity: **make the always-on signals vary again.** A product whose stated principle is "unknown is a first-class value" is currently spending its two scarcest signals on constants.

## What's Working

1. **The eligibility cascade is architecturally real, not cosmetic.** `completedSet` is one piece of global state threaded through a pure `getEligibility()` (`eligibility.mjs`), so every card recomputes from one source of truth — verified live by watching `AD352` react to `EC101` being marked taken. A lesser build would have wired a per-card checkbox with no downstream effect.
2. **Unknown data is stated with receipts.** `Course.svelte:258-270`'s `?` branch cites a measured coverage number in its own comment (314 of 1,324 courses) and its tooltip names the exact claim being avoided. This is what makes "unknown is a first-class value" a practice rather than a slogan.
3. **The mono/sans split is a working instrument.** Every registrar-produced value (code, credits, hours, room, seats, timestamp) is Plex Mono/tabular; everything a human wrote is Schibsted Grotesk. In a catalogue this dense, that is a wordless, always-on way to tell quoted from authored — and measurement confirms it survives every state.

## Priority Issues

### [P1] Row state bleeds across unrelated courses
`CourseCatalogue.svelte:278` — `{#each visibleCourseNames.slice(0, pageSize * page) as courseName, i}` has no key. Svelte reuses `Course` instances by list position, so a row's internal `$state` (`descriptionExpanded`, `treeExpanded`) survives a search change.

**Reproduced under controlled DOM assertions:** searched `calculus`, expanded row index 3 (`MATH101.04`), re-searched `SPA101` — index 3 is now `SPA101.04`, an unrelated course, rendering already expanded, never touched. It also surfaced organically in three screenshots taken for unrelated purposes.

**Why it matters:** the same mechanism reaches the prereq-tree toggle, and `CourseList.svelte:201` has the identical unkeyed `{#each}`. A tool positioned as "a plan a student can trust" is showing state that does not belong to the row it is attached to, and it fails silently — nothing errors, nothing logs.

**Fix:** key both loops on `(courseName)`.
**Suggested command:** `/impeccable harden`

### [P1] Icon action cluster: sub-44px targets and two unnamed controls
Measured live at 390×844 on a real row (`BIO311.01`): mark-taken `10×16`, report-issue `14×16`, syllabus `40×40`, add/remove `40×40`, description toggle `112×16`, prereq-tree toggle `112×16`, instructor `74×20`. Every one is under the 44×44 floor; the two smallest carry no padding classes at all. (Pairwise overlap: 0 — they are small, not colliding.) Separately, `i18nDict.mjs:49-56`'s own comment records that `aria-label` was added to add/remove/syllabus *because axe flagged them nameless* — mark-taken and report-issue were never included and still rely on a bare `✓` glyph or `title`.

**Why it matters:** this cluster repeats on every row of a thousands-of-sections catalogue, on the exact form factor PRODUCT.md names for "decisions made in seconds on whatever device is at hand". Interactive count is identical at 1440×900 and 390×844 (7 controls, 14 text nodes) — nothing is simplified for touch.

**Fix:** give mark-taken and report-issue the same `p-2` pill treatment and `aria-label` the other two already have; raise the pills to 44×44 on touch.
**Suggested command:** `/impeccable adapt`

### [P1] A zero-result search says nothing
A mistyped code (verified with `zzznoresults123`) renders a bare `role="list"` container holding two Svelte comment placeholders — no message, no suggestion, no way forward — directly above the footer's "Good luck in the new semester!".

**Why it matters:** in Operate mode the empty state is where the user is most lost, and this is the one state in the whole card that does not follow the file's own honesty pattern. Every other absence (`Seats: no data`, `? prereqs unchecked`) is labelled and explained; this one is silent, so the app reads as broken rather than as empty. It is also the trigger path for the 1 MB `descriptions.json` fallback fetch, so the moment of zero feedback is also the slowest moment in the app.

**Fix:** an empty state that names the query, states what was searched (code → name → instructor → description), and offers the recovery the surface already has — clear the query, or drop a filter.
**Suggested command:** `/impeccable onboard`

### [P2] Both always-on signals have gone constant
Two independent signals no longer vary, so neither carries information:

- **`"Consent Of Instructor"`** is printed verbatim by `Course.svelte:336-341` on **3,043 of 3,061 sections (99.4%)** of the live term, including mandatory 100-level courses, because quotas are not published pre-registration. It is the one unknown-state in this component that gets no explanatory `title`, two branches away from ones that do.
- **The amber stale-quota stamp** uses a flat 24-hour threshold regardless of season, so outside registration week — most of the year, including the calm-planning peak — it fires on every row permanently. Measured: `#c08428` on `#1f2731`, 4.72:1, the tightest contrast margin in the surface.

**Why it matters:** a colour reserved for "this number is moving, don't trust it" that is on for months teaches the user to ignore it precisely before the week it exists for. And a freshman planning ahead reads "Consent Of Instructor" on Calculus I as "I must email this professor", which is not what the data means.

**Fix:** gloss the generic `ALL`/consent note with the same explanatory-title treatment used two branches over; scale the staleness threshold to distance from add/drop instead of a flat 24h.
**Suggested command:** `/impeccable clarify`

### [P2] "Taken" renders in two different inks on the same card
The read-only eligibility badge (`Course.svelte:233-237`) computes to `#2447c9`/`#97aef3` — DESIGN.md's `cobalt-600`/`cobalt-300`. The manual mark-taken toggle in its active state (`Course.svelte:536-538`) computes to `#2f643a`/`#5c9666` — the `scarcity-open` ramp. Both are visible simultaneously on one `EC101.01` row once marked.

**Why it matters:** DESIGN.md names "the ✓ 'taken' mark" as its worked example of the One Ink Rule, and separately states green means seats ("a count is data, not an alert"). This is the system contradicting its own example while spending the one ink reserved for capacity where the Scarcity Rule forbids it. The report-issue link's `hover:text-red-500` (`Course.svelte:548`) is the same drift: red for a generic "flag an issue" action.

**Fix:** recolour the active mark-taken toggle to cobalt; move the report-issue hover to cobalt like every other secondary control.
**Suggested command:** `/impeccable polish`

## Persona Red Flags

**Casey (Distracted Mobile User)** — the mark-taken button measures **10×16px** and report-issue **14×16px** at 390px, inside a `flex-col-reverse` stack that repeats on every row of a one-handed, interrupted session. Nothing about the row simplifies at that width: same 7 controls, same 14 text fragments as desktop.

**Riley (Deliberate Stress Tester)** — two confirmed hits. Features that appear to work but carry state that isn't theirs (the `MATH101.04` → `SPA101.04` reproduction). Empty states that show nothing useful (the bare `role="list"`).

**Sam (Accessibility-Dependent User)** — of four icon-only controls per row, only two got the `aria-label` fix the code's own history says axe demanded. Every contextual explanation the card offers (`quota.scrapedTitle`, `course.prereqUnknownTitle`, `course.eligibleTitle`) is a hover-only `title`: unreachable by screen reader navigation and by every touch user. Contrast itself is clean — all six sampled classes pass AA in both schemes.

**Deniz (The Calm Planner — PRODUCT.md peak #1)** — reads "Consent Of Instructor" on every course including mandatory intro classes, with nothing to tell her whether she needs to email nine professors before spring or whether the number simply isn't public yet. She has the time to resolve the ambiguity; the interface gives her no means.

**Ece (The Registration-Week Racer — PRODUCT.md peak #2)** — locking a section means tapping a 40×40 `+` pill positioned near a 14×16 report-issue link, one-handed, under time pressure, with no confirmation beyond the pill changing colour.

## Minor Observations

- **[P3] The chip rail defaults to fully expanded.** `CourseCatalogue.svelte:98` — `let isExpanded = $state(true)`. The component implements a real collapsed `h-[32px]` band with a fold toggle (84 chips in the DOM, 23 visible collapsed at 1440px, ~73% hidden), then ships it inverted: first paint shows all of them, and the user's only move is to collapse something that never needed to be open. `/impeccable distill`.
- **Casing drift across surfaces:** the card shouts `FULL`/`DOLU` (`i18nDict.mjs:226`) while the palette says `Full`/`Dolu` (`:156`) for the same fact.
- **No clear (`×`) affordance** on the search input (`CourseCatalogue.svelte:171-187`).
- **Dead branches against real data:** `prereqInfo.gpa` ("Min. GPA:", `Course.svelte:476-484`) has 0 of 6,938 live examples; `course.delivery` has 0 of 3,284 sections carrying the key.
- **One dropped note:** `POR101.01`/`POR201.01` resolve to `kind: "enrolment"`, so the consent note computed by `quotaDisplay()` never reaches the screen (the department restriction still does, via the separate `restricted` flag).
- **DESIGN.md internal inconsistency (my own artifact, from the `document` run):** frontmatter `components.chip-category.typography` points at `{typography.data}` (0.8125rem) while the prose Chips spec says 0.75rem — the shipped code matches the prose. This is what produced the detector's single advisory. Worth one edit to the frontmatter.
- **Description toggle discoverability:** the toggle only enters the DOM after `descriptions.json` (~1 MB) has been fetched, and that fetch is wired only to the zero-match search fallback — so ordinary browsing never reveals it.

## Questions to Consider

- If the occupancy meter is "the reason the design exists", and today the only sections carrying a numeric quota are 18 language electives all sitting at `current: 0` — what does a first-time visitor learn about the product's central promise before registration week begins?
- Is "Consent Of Instructor" a per-section policy or a system-wide pre-registration placeholder? If the latter, why does a product built on "never invent data" surface it as if it were the former?
- The catalogue reuses component instances by position. Now that `descriptionExpanded`/`treeExpanded` are confirmed to bleed, what else rides that mechanism during a fast, back-to-back registration-week search session?
- Were the icon cluster's sub-16px targets ever tapped with an actual thumb, or only clicked with a mouse?
- Should the staleness threshold scale with distance from add/drop, so the one colour reserved for "this number is moving" doesn't fire for months at a stretch?
