---
name: BOUN Course Planner
description: A registration tool drawn as a document — paper, ink, hairline rules, one stamp of cobalt.
colors:
  paper: "#fbfcfd"
  ink: "#0b0d11"
  ink-grey-50: "#f5f7f9"
  ink-grey-100: "#ecf0f3"
  ink-grey-200: "#dde2e8"
  ink-grey-300: "#c2cad3"
  ink-grey-400: "#939ea9"
  ink-grey-500: "#67737f"
  ink-grey-600: "#4f5a66"
  ink-grey-700: "#38424d"
  ink-grey-800: "#1f2731"
  ink-grey-900: "#131a22"
  ink-grey-950: "#0c1118"
  cobalt-50: "#eef2fd"
  cobalt-100: "#dce4fb"
  cobalt-200: "#c0cef8"
  cobalt-300: "#97aef3"
  cobalt-500: "#3c60e0"
  cobalt-600: "#2447c9"
  cobalt-700: "#1d39a3"
  cobalt-900: "#16285f"
  scarcity-open-100: "#d8e8da"
  scarcity-open-500: "#3e7c4a"
  scarcity-open-600: "#2f643a"
  scarcity-open-900: "#17301d"
  scarcity-filling-100: "#f4e4c2"
  scarcity-filling-400: "#c08428"
  scarcity-filling-600: "#855717"
  scarcity-filling-900: "#3f2a0c"
  scarcity-full-100: "#f5d9d6"
  scarcity-full-500: "#b33a30"
  scarcity-full-600: "#942e26"
  scarcity-full-900: "#481713"
typography:
  masthead:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  data:
    fontFamily: "Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0"
    fontFeature: "tabular-nums"
  label:
    fontFamily: "Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
  spine:
    fontFamily: "Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0"
    fontFeature: "tabular-nums"
  chip:
    fontFamily: "Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  xs: "1px"
  sm: "2px"
  md: "2px"
  lg: "3px"
  xl: "4px"
  2xl: "4px"
  3xl: "6px"
  full: "9999px"
spacing:
  hair: "0.125rem"
  xs: "0.25rem"
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.cobalt-600}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.375rem 0.75rem"
  button-primary-hover:
    backgroundColor: "{colors.cobalt-700}"
    textColor: "{colors.paper}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-grey-700}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.5rem"
    height: "auto"
  button-quiet-hover:
    backgroundColor: "transparent"
    textColor: "{colors.cobalt-600}"
  pill-add:
    backgroundColor: "{colors.scarcity-open-100}"
    textColor: "{colors.scarcity-open-600}"
    rounded: "{rounded.md}"
    padding: "0.5rem"
  pill-remove:
    backgroundColor: "{colors.scarcity-full-100}"
    textColor: "{colors.scarcity-full-600}"
    rounded: "{rounded.md}"
    padding: "0.5rem"
  pill-syllabus:
    backgroundColor: "{colors.cobalt-100}"
    textColor: "{colors.cobalt-600}"
    rounded: "{rounded.md}"
    padding: "0.5rem"
  input-search:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-grey-900}"
    rounded: "{rounded.md}"
    padding: "0.375rem 0.75rem 0.375rem 2.5rem"
  select-semester:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-grey-900}"
    typography: "{typography.data}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 1.5rem 0.25rem 0.25rem"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-grey-900}"
    rounded: "{rounded.lg}"
    padding: "0"
  card-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-grey-900}"
    padding: "0.625rem 1rem"
  card-row-hover:
    backgroundColor: "{colors.ink-grey-50}"
  dialog:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-grey-900}"
    rounded: "{rounded.lg}"
    padding: "1rem"
    width: "32rem"
  chip-category:
    backgroundColor: "transparent"
    textColor: "{colors.ink-grey-600}"
    typography: "{typography.chip}"
    padding: "0 0.125rem"
  chip-category-hover:
    backgroundColor: "transparent"
    textColor: "{colors.cobalt-600}"
  palette-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink-grey-900}"
    padding: "0.5rem 0.75rem"
  palette-row-active:
    backgroundColor: "{colors.cobalt-50}"
    textColor: "{colors.ink-grey-900}"
---

# Design System: BOUN Course Planner

## Overview

**Creative North Star: "The Boğaz Editorial"**

A registration tool is a document, not an app. This one is drawn to read like the official schedule form it replaces: paper, ink, ruled columns, and exactly one stamp of colour. The chrome is a single cool ink-grey ramp printed on paper white; cobalt — the Bosphorus blue — is the only interaction ink in the interface; saturated warm colour is withheld for the one thing worth shouting about, which is occupancy pressure and clashes. Nothing is coloured decoratively and nothing floats. Hierarchy is drawn with hairline rules, weight and whitespace.

The type does the editorial work. Schibsted Grotesk, a newspaper grotesk drawn for mastheads, carries the interface; IBM Plex Mono carries anything the registration system produced — course codes, slot times, seat counts, timestamps. The mono is semantic, not decorative: it marks machine data, and its tabular figures stop numbers from shifting width as they change. Both faces are self-hosted, because the service worker only caches same-origin requests and a CDN webfont would vanish exactly when the app matters most: offline, mid-campus.

The system is deliberately dense and deliberately quiet. Components are graphite at rest and take the cobalt ink on contact. Radii collapse to 1–4px throughout, because a document has edges, not pillows. The one place the design is allowed to be loud is the occupancy meter, since nothing else in the BOUN ecosystem tells a student whether a section is actually gettable.

**Key Characteristics:**

- One neutral ramp (cool ink-grey), one interaction ink (cobalt), one meaning-bearing ramp (open / filling / full).
- Mono means machine data; sans means human language. No exceptions.
- Hairline rules and whitespace instead of shadows; near-square corners (1–4px).
- Dense, tabular, print-adjacent: 11–15px text, 2.25rem grid rows, tabular figures everywhere numbers appear.
- Quiet at rest, ink on contact: graphite borders and labels that turn cobalt on hover.
- Unknown data is stated, italicised or greyed — never rendered as a confident number.

## Colors

One cool ink-grey ramp for all chrome, one cobalt for all interaction, a three-step scarcity ramp that is the only colour permitted to carry risk, and a separate twelve-hue palette that exists solely to give a selected course an identity in the timetable.

### Primary

- **Bosphorus Cobalt** (`{colors.cobalt-500}` / `{colors.cobalt-600}`): the single interaction ink. Focus rings, hover borders, hover text, checked checkboxes, the active command-palette row, the solid Apply / Add-to-Calendar button, the "✓ taken" mark, the current node of the prerequisite tree. Cobalt on a surface always means *you can act here, or you already did*.

### Secondary

- **Scarcity Open** (`{colors.scarcity-open-500}`): seats left, meter fill below 85%, add-section pill. Muted, never a "success" green.
- **Scarcity Filling** (`{colors.scarcity-filling-400}` / `{colors.scarcity-filling-600}`): meter fill at ≥85% occupancy, missing prerequisites ("Needs: …"), stale quota timestamps, an inferred (not published) roadmap term, blocking nodes in the prerequisite tree.
- **Scarcity Full** (`{colors.scarcity-full-500}` / `{colors.scarcity-full-600}`): FULL and over-enrolled sections, the hatched overflow tail of the meter, timetable clash rings, final-exam clashes, remove-section pill.

### Tertiary

- **The Course Twelve**: a fixed twelve-hue ramp (red, orange, amber, yellow, lime, emerald, teal, sky, blue, indigo, fuchsia, pink) used *only* to identify a selected course inside the timetable. A course's hue is an FNV-1a hash of its section key, so the same course is the same colour on every visit and across every device. Each entry is a near-white `-50` fill, a firm `-600` left accent rule, and `-800` text — a ledger line, not a sticker. The PNG export draws the same twelve entries from their hex fields, so screen and exported image cannot drift apart.

### Neutral

- **Paper White** (`{colors.paper}`) and **Ink** (`{colors.ink}`): the substrate in light and dark. Both are cast a degree cool so that cobalt reads as the same ink at full strength; neither is pure `#fff`/`#000`.
- **Ink Grey 100–300**: hairline rules, dividers, card borders, meter track, unchecked control borders.
- **Ink Grey 400–500**: placeholders, decorative chevrons, disabled-ish marks.
- **Ink Grey 600–700**: the workhorse secondary text — labels, eyebrows, spine digits, metadata. `600` is the floor for small text on paper, because `500` measures 4.37:1 and misses AA.
- **Ink Grey 800–950**: dark-mode surfaces (`800` panels, `900` sunken/nested surfaces, `950`/Ink page ground) and light-mode primary text.

### Named Rules

**The One Ink Rule.** Cobalt is the only interaction colour in the chrome. If an element responds to the cursor, it turns cobalt; if it turns cobalt, it responds to the cursor. No second accent is introduced for emphasis, branding or variety.

**The Scarcity Rule.** Green, amber and red are reserved for capacity and risk: seats, occupancy, clashes, staleness. Credits, ECTS, section counts and selection counts stay on the ink-grey ramp even when a status pill is tempting — *a count is data, not an alert; green means seats.*

**The Ledger Line Rule.** The twelve course hues are identity, not decoration. They appear only as a timetable block's `-50` fill with a 3px `-600` left rule, are assigned by hash rather than by selection order, and never leak into buttons, badges or chrome.

## Typography

**Display Font:** Schibsted Grotesk (self-hosted, variable 400–900; falls back to `ui-sans-serif`, `system-ui`, `-apple-system`)
**Body Font:** Schibsted Grotesk — the same face; hierarchy comes from weight and size, not from a second family
**Label/Mono Font:** IBM Plex Mono (self-hosted, 400 + 600; falls back to `ui-monospace`, `SF Mono`, `Menlo`)

**Character:** A newspaper grotesk against an engineer's mono. Schibsted is compact and slightly editorial, so tracking stays at the metal (`letter-spacing: 0`) and `font-synthesis-weight` is off — every weight is a real cut. Plex Mono is not a style choice: it is the mark of data the registration system produced, with tabular figures so seat counts and hours never re-flow as they update. Both faces ship `latin` and `latin-ext` subsets because Turkish needs both — `ı` lives in one, `İ ş ğ` in the other.

### Hierarchy

- **Masthead** (800, 0.9375rem, `-0.02em`): the app title only. One instance, in the header bar.
- **Title** (600, 0.9375rem): panel and card titles, total-credit values, the selected-section count.
- **Identifier** (mono 600, 0.8125–0.9375rem): course codes and section keys. Always mono + semibold, sized by hierarchy level, never sans.
- **Body** (400, 0.875rem): course names, descriptions, instructions, prose. Descriptions run at 0.875rem with `whitespace-pre-line`; catalogue text is never widened past its column.
- **Data** (mono 400, 0.6875–0.8125rem, tabular): schedules, rooms, credits, seat counts, timestamps, semester name, EN/TR toggle.
- **Chip** (mono 500, 0.75rem): department chips only — the one size between Data and Label, unchromed and unfilled.
- **Label / eyebrow** (mono 600, 0.625rem, `0.08em`, uppercase): section headings, day-column headers, dialog titles, the total-credit label.
- **Spine** (mono 600, 0.6875rem, tabular, right-aligned) with **Spine-minute** (400, 0.5625rem): the hour gutter of the timetable. The minutes drop to a smaller, lighter mark at the same ink, because hierarchy here is carried by size and weight — colour would fail the contrast floor.

### Named Rules

**The Machine Data Rule.** If the registration system produced the value — a code, an hour, a room, a seat count, a timestamp — it is set in mono with tabular figures. If a human wrote it, it is set in the grotesk. This is how a student tells, at a glance, what is quoted and what is authored.

**The Ink Floor Rule.** Small text (≤11px) never goes lighter than Ink Grey 600 on paper or Ink Grey 400 on ink. Contrast is checked by the axe gate in both schemes, so a lighter grey is not a style decision, it is a failing test.

## Layout

Two panes, one document. Above `md` (768px) the app is a fixed-height, non-scrolling shell: the header bar, then a 5/12 pane (timetable, then the selected-course list) beside a 7/12 pane (search, filters, catalogue), each scrolling independently with `overflow-y-auto`. Below `md` the same order stacks into a single scrolling column — timetable first, catalogue below — and the floating ⌘K button becomes the primary way into search.

The header is a two-rule masthead: a 2px ink rule under a 2.75rem bar, then a 3px gap and a hairline — an Oxford double rule, the one piece of pure typographic ornament in the system.

Spacing is a tight 4px-based rhythm: `0.5rem` shell padding, `1rem` horizontal card padding, `0.625rem` vertical for a course row, `0.375rem` for a list row, `0.25rem` gaps inside control clusters. The timetable is a fixed table, `2.25rem` per hour row, `3.5rem` sticky hour gutter, `5rem` day columns, `min-width: 32rem` with horizontal scroll below that; the sticky corner and gutter sit above the grid on their own z-layers. Overlapping sections split a cell into equal percentage sub-columns with a 1px gap, and a course keeps one horizontal offset for its whole vertical band so a multi-hour block is never sliced.

Overlays are sized to their content, not to the viewport: the filter dialog is `max-w-lg` (32rem), the command palette `max-w-2xl` (42rem) opening at `10vh`, the occupancy meter caps at `11rem`.

## Elevation & Depth

Flat by doctrine. There is no shadow vocabulary: depth is drawn with hairline rules, tonal surface steps (paper → Ink Grey 50 for hover, Ink Grey 800 → 900 for nested dark surfaces) and border weight. Modality is signalled by a heavier 2px ink border plus a `bg-black/60` backdrop, not by a lift. Only two box-shadows exist, and neither reads as elevation:

- **Row rule** (`box-shadow: inset 0 1px 0 0` Ink Grey 100; dark: Ink Grey 700 at 60%): the timetable's hour line. It is a shadow purely for layout reasons — a real `border-top` would shift the cell's content box and split a multi-hour course into separate slabs.
- The catalogue search wrapper carries a single default `shadow`, the one residual lift in the app.

### Named Rules

**The Flat Document Rule.** Surfaces do not lift. If something needs to separate from its neighbour, it gets a hairline, a tonal step, or whitespace — in that order. New shadow tokens are not part of this system.

## Shapes

Near-square. Every radius token collapses to 1–4px (`sm`/`md` = 2px, `lg` = 3px, `xl` = 4px), so cards, dialogs, inputs and pills all read as cut paper rather than rounded widgets; `rounded-full` is untouched, because dots and instructor chips are genuinely round. Timetable blocks have no radius at all: they are rules on a grid, marked by a 3px left accent bar.

Borders are the primary form language and come in exactly three weights: **1px** Ink Grey 200/700 for cards, dividers and controls; **2px** ink (Ink Grey 900 / 200 inverted) for the masthead rule and modal surfaces; **3px** left accent for a timetable block. The prerequisite tree is the one geometric departure — a hand-drawn SVG graph with `rx=4` nodes and 1.5px Ink Grey 300 edges.

## Components

Everything is Tailwind utility composition; the shared vocabulary lives as six global classes in `src/app.css` (`.u-data`, `.eyebrow`, `.spine`/`.spine-min`, `.row-rule`, `.btn-quiet`, `.meter`). Character line for all of it: **quiet at rest, ink on contact.**

### Buttons

- **Shape:** near-square (2px, `rounded-md`/`rounded-sm`); pills are square too — only instructor chips go `rounded-full`.
- **Primary (`.btn-primary` pattern):** solid Cobalt 600 on paper-white text, `0.375rem 0.75rem`, 0.875rem/500. Used sparingly — the filter dialog's Apply and the calendar export. Hover deepens to Cobalt 700 (dark mode brightens to Cobalt 500 instead).
- **Quiet (`.btn-quiet`):** the default secondary action — 1px Ink Grey 300 border, Ink Grey 700 text, no fill, `0.125rem 0.5rem`, 0.75rem/500. Hover swaps *both* border and text to cobalt over 150ms; disabled is `opacity: 0.4` + `not-allowed`, driven by the native `disabled` attribute, never by a greyed-out colour override. Copy-link, roadmap toggle, conflict-free solver, undo, clear.
- **Outline icon button:** same recipe expressed inline for icon-led actions (filters trigger, PNG export, Google Calendar, floating ⌘K) — 1px Ink Grey 300 border, Ink Grey 600 icon, cobalt border + icon on hover.
- **Filled action pill:** `p-2`, 2px radius, tinted `-100` background with `-600` glyph, deepening one step on hover. Three hues only: cobalt (syllabus), Scarcity Open (add section), Scarcity Full (remove section).
- **Focus:** every control inherits one global treatment — a 2px Cobalt 500 outline at 2px offset. Do not add per-component focus rings; the two that exist (the search input's `focus:ring-1`, the semester select's `focus:ring-2`) are the exceptions, not the pattern.

- **Touch:** every icon control is a 44×44 target below `sm`, relaxing to 36×36 above it. Four stacked 44px targets would own a phone row, so on touch they sit in a 2×2 block rather than a column.

### Chips

- **Category chips:** mono, 0.75rem/500, Ink Grey 600, no border and no fill — deliberately unchromed, because sixty filled pills read as a wall. Cobalt text on hover.
- **Instructor chips:** `.btn-quiet` with `rounded-full`, the only round shape in the interface.
- **Eyebrow chip:** the catalogue's show-more toggle is the single `.eyebrow` with a background (Ink Grey 100 / Ink), because it straddles a scroll edge.

### Cards / Containers

- **Corner Style:** 3px (`rounded-lg`), `overflow-hidden` so child rules meet the edge cleanly.
- **Background:** Paper White; Ink Grey 800 in dark mode. Nested/sunken surfaces (prerequisite tree, roadmap column body) drop to Ink Grey 900.
- **Shadow Strategy:** none — see Elevation & Depth.
- **Border:** 1px Ink Grey 200 / 700. Internal structure is `divide-y` at the same weight for top-level blocks and one step lighter (Ink Grey 100 / 700 at 60%) for rows nested inside a block.
- **Internal Padding:** `1rem` horizontal, `0.625rem` vertical for a header or course row, `0.375rem` for a compact list row. Rows hover to Ink Grey 50 (dark: Ink Grey 900 at 40%).

This one template — 3px radius, 1px border, paper surface, `divide-y` — is the catalogue, the selected-course list, the instructor panel and the roadmap. New panels use it rather than inventing a container.

### Inputs / Fields

- **Search:** 1px Ink Grey 200, paper fill, 2px radius, `0.375rem 0.75rem` with `2.5rem` left inset for the icon, Ink Grey 400 placeholder. Focus shifts the border to Cobalt 500 and adds a 1px cobalt ring.
- **Semester select:** `appearance-none` mono control with a manually placed chevron in Ink Grey 400; hover takes the cobalt border, focus a 2px cobalt ring.
- **Checkboxes:** `appearance-none`, 3px radius, 1px Ink Grey 300 border, filling to solid Cobalt 500 when checked. The timetable day/hour grid uses the same control at 80% opacity, to separate a bulk time filter from a single option.
- **Command palette input:** borderless except for a bottom hairline, 1.125rem, `0.75rem` padding — the panel's own 2px border does the containing.
- **Error / Disabled:** inputs have no error state; validation lives in the data, not the form. Disabled controls use the native attribute with `opacity: 0.4`.

- **Empty:** a state with nothing in it still owes the reader a sentence and a way out — the query echoed verbatim (never through `.eyebrow`, which uppercases), what was searched, and the controls that undo it. A `role="list"` with no items is not an empty state, it is a bug.

### Navigation

There is no nav bar. The masthead holds the title, the EN/TR segmented toggle (mono, 0.6875rem/600; the active half inverts to solid ink with paper text) and the semester select pushed right. Navigation happens through search, the ⌘K palette, and URL state.

### The Occupancy Meter (signature component)

The one loud element, and the reason the design exists. A 2px rule under a section's seat count, `max-width: 11rem`, track in Ink Grey 200 (dark: 700). Its fill is `--fill` (current/quota) in `currentColor`, so the wrapper's text colour *is* the meter colour: Scarcity Open below 85%, Scarcity Filling at ≥85%, Scarcity Full when full or over-enrolled. The point is the tail: an over-enrolled section spills past the end of the track into a `--over` segment drawn as a 45° hatch, instead of clamping at 100% and quietly lying about a full section. Fill and tail animate at 220ms `cubic-bezier(0.2, 0, 0, 1)`, and not at all under `prefers-reduced-motion`. It is `aria-hidden`: the numbers beside it carry the same fact to a screen reader.

### Command Palette

A 42rem panel at `10vh` over a `bg-black/40` backdrop: 2px ink border, 3px radius, no shadow. Sticky mono group headers on Ink Grey 50, and result rows whose *only* active treatment is a Cobalt 50 fill — keyboard-active and hover share one visual state, so there is never a second highlight competing with the caret. Each row carries mono metadata (section, hours, rooms, credits) with seats in Ink Grey 600, or bold Scarcity Full when the section is full.

### The annotation slot

Every explanation on a card lands in one place: a single line at the foot of the card's text column, above a hairline, in 0.75rem Ink Grey 600. The marks that own an explanation — eligibility, "prereqs unchecked", the enrolment snapshot stamp, the quota note — are disclosure buttons (`aria-expanded`) that write their sentence into it, because a `title` tooltip reaches neither a touch user nor a screen reader. One slot per card, always in the same position: the explanation never floats, and it never moves the row it belongs to.

## Do's and Don'ts

### Do:

- **Do** express interaction only in cobalt: `hover:border-blue-500 hover:text-blue-600` (dark: `blue-400`/`blue-300`) is the house hover, and the global 2px Cobalt 500 `:focus-visible` outline is the house focus.
- **Do** set every machine-produced value in `.u-data` (mono + tabular figures) and every human label in the grotesk.
- **Do** reuse the container template — `rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800` with `divide-y` — for any new panel.
- **Do** separate surfaces with a hairline, a tonal step or whitespace, in that order.
- **Do** keep small text at Ink Grey 600 on paper and Ink Grey 400 on ink, and re-run the axe gate in both schemes after touching a colour.
- **Do** state absent data as absent: italic "unpublished", a greyed "?" for unknown prerequisites, an "≈" for an inferred term.
- **Do** reach for `.btn-quiet` for secondary actions, and let the native `disabled` attribute carry the disabled state.
- **Do** honour `prefers-reduced-motion`: the global reset kills transitions, and the meter opts out explicitly.
- **Do** give an inline text control at least a 24px target (`min-h-6`) and an icon control 44px on touch.
- **Do** put an explanation in the annotation slot as a disclosure. A `title` may repeat it for the mouse; it may never be the only copy.

### Don't:

- **Don't** introduce a second accent hue into the chrome. Cobalt is the only interaction ink.
- **Don't** spend green, amber or red on anything that is not capacity, staleness or a clash. Credits, ECTS and counts stay ink-grey — a count is data, not an alert.
- **Don't** let the twelve course hues out of the timetable, and don't assign them by selection order; the hash is what keeps a course the same colour everywhere.
- **Don't** add a `box-shadow`. Nothing in this system lifts.
- **Don't** soften a corner past 4px, or add a radius to a timetable block.
- **Don't** add a per-component focus ring when the global outline already fires.
- **Don't** load a font from a CDN — the service worker only caches same-origin, and both `latin` and `latin-ext` subsets are required for Turkish.
- **Don't** clamp an over-enrolled meter at 100%, and don't render a missing quota as `0`.
- **Don't** build a filled pill for a value that has no risk attached to it.
- **Don't** leave an explanation in a `title` alone, and don't let a signal fire on every row — an amber stamp or a consent note that is always on has stopped saying anything.
