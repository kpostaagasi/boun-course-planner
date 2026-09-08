---
name: BOUN Course Planner
description: A calm, minimal planner for students — soft neutral ground, one accent, and colour spent only on seats and clashes.
colors:
  surface: "#ffffff"
  ground: "#fafafa"
  ink: "#0f1012"
  neutral-50: "#fafafa"
  neutral-100: "#f4f4f6"
  neutral-200: "#e7e7ea"
  neutral-300: "#d3d3d8"
  neutral-400: "#9c9ca5"
  neutral-500: "#6b6b75"
  neutral-600: "#5c5c66"
  neutral-700: "#45454d"
  neutral-800: "#1f1f24"
  neutral-900: "#161619"
  neutral-950: "#0f0f11"
  accent-50: "#eff4ff"
  accent-100: "#dbe6fe"
  accent-200: "#c3d4fd"
  accent-300: "#93b4fd"
  accent-500: "#3b76f6"
  accent-600: "#2563eb"
  accent-700: "#1d4ed8"
  accent-950: "#172554"
  scarcity-open-100: "#d7ecdc"
  scarcity-open-500: "#3a804d"
  scarcity-open-700: "#245433"
  scarcity-filling-100: "#f8e7c5"
  scarcity-filling-500: "#a36f1e"
  scarcity-filling-700: "#6b4713"
  scarcity-full-50: "#fdf1f0"
  scarcity-full-100: "#f9dcda"
  scarcity-full-500: "#b9433a"
  scarcity-full-600: "#99342c"
  scarcity-full-700: "#7c2a24"
typography:
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  heading:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  meta:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  data:
    fontFamily: "Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  identifier:
    fontFamily: "Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0"
  spine:
    fontFamily: "Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "14px"
  2xl: "18px"
  3xl: "22px"
  full: "9999px"
spacing:
  hair: "0.125rem"
  xs: "0.25rem"
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  2xl: "1.25rem"
shadow:
  xs: "0 1px 2px 0 rgb(16 17 20 / 0.04)"
  sm: "0 1px 2px 0 rgb(16 17 20 / 0.05)"
  md: "0 4px 12px -2px rgb(16 17 20 / 0.08)"
  lg: "0 12px 32px -8px rgb(16 17 20 / 0.14)"
components:
  button-primary:
    backgroundColor: "{colors.accent-600}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.875rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-700}"
    textColor: "{colors.surface}"
  button-quiet:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.neutral-700}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.3125rem 0.625rem"
  button-quiet-hover:
    backgroundColor: "{colors.neutral-200}"
    textColor: "{colors.neutral-900}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-600}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0"
  button-text-hover:
    backgroundColor: "transparent"
    textColor: "{colors.accent-600}"
  action-add:
    backgroundColor: "{colors.accent-600}"
    textColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    width: "2.75rem"
    height: "2.75rem"
  action-remove:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.neutral-600}"
    rounded: "{rounded.xl}"
    width: "2.75rem"
    height: "2.75rem"
  action-remove-hover:
    backgroundColor: "{colors.scarcity-full-50}"
    textColor: "{colors.scarcity-full-600}"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral-900}"
    rounded: "{rounded.xl}"
    padding: "0.625rem 2.75rem"
    shadow: "{shadow.xs}"
  select-semester:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral-900}"
    typography: "{typography.data}"
    rounded: "{rounded.lg}"
    padding: "0.375rem 1.75rem 0.375rem 0.625rem"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral-900}"
    rounded: "{rounded.lg}"
    padding: "0"
    shadow: "{shadow.xs}"
  card-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral-900}"
    padding: "0.75rem 1rem"
  card-row-hover:
    backgroundColor: "{colors.neutral-50}"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral-900}"
    rounded: "{rounded.2xl}"
    padding: "1.25rem"
    width: "32rem"
    shadow: "{shadow.lg}"
  chip-category:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.neutral-600}"
    rounded: "{rounded.full}"
    padding: "0.25rem 0.625rem"
  chip-category-hover:
    backgroundColor: "{colors.neutral-200}"
    textColor: "{colors.neutral-900}"
  badge-alert:
    backgroundColor: "{colors.scarcity-full-50}"
    textColor: "{colors.scarcity-full-700}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  palette-row:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-900}"
    padding: "0.625rem 1rem"
  palette-row-active:
    backgroundColor: "{colors.accent-50}"
    textColor: "{colors.neutral-900}"
---

# Design System: BOUN Course Planner

## Overview

**Creative North Star: "Sade"** — plain, in the Turkish sense: nothing added that
does not earn its place.

A student opens this app twice: once in the calm week before registration, and
once at 09:00 on the morning add-drop opens, with a quota moving under them and
about two seconds of patience. The second visit governs the design. Every
surface is arranged around one question — *can I still get this section, and does
it fit?* — and anything that does not help answer it moves out of the way.

So the app is quiet by default: a soft neutral ground, white cards, one calm
accent, and generous whitespace instead of rules and boxes. Depth is a single
hairline and a shadow you have to look for. Colour is rationed: the accent means
*you can act here*, and green / amber / red mean *seats*, *filling*, *gone or
clashing*. Nothing else is coloured at all.

The other half of "sade" is progressive disclosure. The catalogue holds 3140
sections in a live term, and each one has exam dates, prerequisite chains,
cross-listings, catalogue text, an offering history and three secondary actions
attached to it. All of that is still here — none of it was deleted — but it sits
behind one `Details` disclosure per card, so a row shows five lines and one
button instead of eleven rows and four. Minimal means fewer things competing at
once, not fewer things available.

The type carries the last of the work. Schibsted Grotesk for anything a person
wrote; IBM Plex Mono for anything the registration system produced — course
codes, clock times, room numbers, seat counts, timestamps. The mono is semantic,
not decorative: it marks quoted machine data, and its tabular figures stop
numbers from re-flowing as they update. Both faces are self-hosted, because the
service worker only caches same-origin requests and a CDN webfont would vanish
exactly when the app matters most: offline, mid-campus.

**Key Characteristics:**

- One neutral ramp, one accent, one three-step scarcity ramp. No fourth hue in the chrome.
- Mono means machine data; sans means human language. No exceptions.
- Soft corners (8px controls, 12px cards, 18px dialogs) and a barely-there shadow — approachable, not ornamental.
- Whitespace first, hairline second, tint third. Boxes and dividers are a last resort.
- One primary action per row. Everything else lives under `Details`.
- Unknown data is stated, italicised or greyed — never rendered as a confident number.

## Colors

One dead-neutral ramp for all chrome, one accent for all interaction, a
three-step scarcity ramp that is the only colour permitted to carry risk, and a
separate twelve-hue palette whose sole job is to give a selected course an
identity in the timetable.

### Primary

- **Accent** (`{colors.accent-600}`, with `{colors.accent-500}` for fills and rings): the single interaction colour. The add-section button, the Apply and Add-to-Calendar buttons, focus rings, checked checkboxes, the active command-palette row, hover on a text control, the "taken" badge, the current node of the prerequisite tree. Accent on a surface always means *you can act here, or you already did*.

### Secondary

- **Scarcity Open** (`{colors.scarcity-open-500}` / `{colors.scarcity-open-700}`): seats left, meter fill below 85%.
- **Scarcity Filling** (`{colors.scarcity-filling-500}` / `{colors.scarcity-filling-700}`): meter fill at ≥85%, missing prerequisites ("Needs: …"), a stale quota timestamp, blocking nodes in the prerequisite tree.
- **Scarcity Full** (`{colors.scarcity-full-500}` / `{colors.scarcity-full-600}`): FULL and over-enrolled sections, the hatched overflow tail of the meter, timetable clash rings, the clash badge, final-exam clashes, remove-on-hover.

All three are pulled a step off stock Tailwind saturation, because a list of a
hundred sections rendered in stock green/amber/red reads as a traffic light
rather than as information.

### Tertiary

- **The Course Twelve**: a fixed twelve-hue ramp (red, orange, amber, yellow, lime, emerald, teal, sky, blue, indigo, fuchsia, pink) used *only* to identify a selected course inside the timetable. A course's hue is an FNV-1a hash of its section key, so the same course is the same colour on every visit and across every device. Each entry is a near-white `-50` fill with a 3px `-600` rule down its leading edge and `-800` text. The PNG export draws the same twelve entries from their hex fields, so screen and exported image cannot drift apart.

### Neutral

- **Surface** (`{colors.surface}`) and **Ground** (`{colors.ground}`): cards sit white on a barely-tinted page. In dark mode the pair inverts to `{colors.neutral-800}` on `{colors.neutral-950}`.
- **Neutral 100–300**: hairlines, dividers, card borders, meter track, quiet-button fill, unchecked control borders.
- **Neutral 400**: placeholders, decorative chevrons, the ✕ on a selected-course row.
- **Neutral 500–700**: secondary and tertiary text — labels, metadata, spine digits. `500` is pulled a step darker than an even ramp would put it, because it is the tertiary text colour and has to clear 4.5:1 on the *ground*, not just on card white.
- **Neutral 800–950**: dark-mode surfaces (`800` cards, `900` nested/sunken, `950` page ground) and light-mode primary text.

### Named Rules

**The One Accent Rule.** The accent is the only interaction colour in the chrome.
If an element responds to a click, it is accent or it is neutral-on-hover; no
second accent is introduced for emphasis, branding or variety.

**The Scarcity Rule.** Green, amber and red are reserved for capacity and risk:
seats, occupancy, clashes, staleness. Credits, ECTS, section counts and selection
counts stay on the neutral ramp even when a status pill is tempting — *a count is
data, not an alert; green means seats.*

**The Ledger Line Rule.** The twelve course hues are identity, not decoration.
They appear only as a timetable block's `-50` fill with a 3px `-600` leading
rule, are assigned by hash rather than by selection order, and never leak into
buttons, badges or chrome.

## Typography

**Display Font:** Schibsted Grotesk (self-hosted, variable 400–900; falls back to `ui-sans-serif`, `system-ui`, `-apple-system`)
**Body Font:** Schibsted Grotesk — the same face; hierarchy comes from weight and size, not from a second family
**Data Font:** IBM Plex Mono (self-hosted, 400 + 600; falls back to `ui-monospace`, `SF Mono`, `Menlo`)

**Character:** A clean grotesk against an engineer's mono. Schibsted is compact
and quietly modern, so tracking stays at the metal and `font-synthesis-weight` is
off — every weight is a real cut. Plex Mono is not a style choice: it is the mark
of data the registration system produced, with tabular figures so seat counts and
hours never re-flow as they update. Both faces ship `latin` and `latin-ext`
subsets because Turkish needs both — `ı` lives in one, `İ ş ğ` in the other.

### Hierarchy

- **Title** (600, 1rem, `-0.015em`): the app name in the top bar. One instance.
- **Heading** (600, 0.9375rem): panel headings, the empty-state sentence, total-credit values.
- **Identifier** (mono 600, 0.9375rem, tabular): course codes and section keys — the thing a student types into the registration system. Always mono + semibold, never sans.
- **Body** (400, 0.875rem): course names, descriptions, prose.
- **Meta** (400, 0.8125rem): the practical line of a card — instructor, seats, everything under `Details`.
- **Data** (mono 400, 0.6875–0.8125rem, tabular): schedules, rooms, credits, seat counts, timestamps, term name.
- **Label** (500, 0.75rem, Neutral 600): section labels and column headers. Sentence case, in the interface face — the old all-caps mono eyebrow shouted every heading in a product whose headings are all mundane ("Courses", "Filters", "Total Credits").
- **Spine** (mono 500, 0.6875rem, tabular, right-aligned): the hour gutter of the timetable, with the minutes dropping to weight 400 at the same size and ink, because colour there would fail the contrast floor.

### Named Rules

**The Machine Data Rule.** If the registration system produced the value — a
code, an hour, a room, a seat count, a timestamp — it is set in mono with tabular
figures. If a human wrote it, it is set in the grotesk. This is how a student
tells, at a glance, what is quoted and what is authored.

**The Ink Floor Rule.** Small text never goes lighter than Neutral 500 on the
ground or Neutral 400 on dark. Contrast is checked by the axe gate in both
schemes, so a lighter grey is not a style decision, it is a failing test.

## Layout

Two panes, one page. Above `md` (768px) the app is a fixed-height, non-scrolling
shell: a 3.5rem top bar, then a 5/12 pane (timetable, then the selected-course
panel) beside a 7/12 pane (search, filters, catalogue), each scrolling
independently. The whole thing is capped at `110rem` and centred, so a 32"
monitor gets whitespace rather than a stretched course row. Below `md` the same
order stacks into a single scrolling column — timetable first, catalogue below —
and the floating ⌘K button becomes the primary way into search.

The top bar is a single hairline over the page: title left, term and EN/TR right,
nothing else. Panes are separated by a `1rem` gutter and panels within a pane by
`0.75rem`, so the structure is read from whitespace before any border is
noticed.

Spacing is a 4px rhythm: `0.75–1rem` shell padding, `1rem` horizontal card
padding, `0.75rem` vertical for a course row, `0.5rem` for a list row, `0.5rem`
gaps inside control clusters. The timetable is a fixed table, `2.25rem` per hour
row, `3.5rem` sticky hour gutter, `5rem` day columns, `min-width: 32rem` with
horizontal scroll below that; the sticky corner and gutter sit above the grid on
their own z-layers. Overlapping sections split a cell into equal percentage
sub-columns with a 1px gap, and a course keeps one horizontal offset for its
whole vertical band so a multi-hour block is never sliced.

Overlays are sized to their content, not to the viewport: the filter dialog is
`max-w-lg` (32rem), the command palette `max-w-2xl` (42rem) opening at `10vh`,
the occupancy meter caps at `11rem`.

## Elevation & Depth

Almost flat. Four shadow tokens exist and three of them are nearly invisible:
`xs` on resting cards and the search field, `md` on the floating ⌘K button, `lg`
on the two overlays. Everything else
separates with a hairline, a tonal step (surface → Neutral 50 on hover; Neutral
800 → 900 for nested dark surfaces) or plain whitespace.

One box-shadow is not elevation at all:

- **Row rule** (`box-shadow: inset 0 1px 0 0` Neutral 100; dark: Neutral 700 at 45%): the timetable's hour line. It is a shadow purely for layout reasons — a real `border-top` would shift the cell's content box and split a multi-hour course into separate slabs.

### Named Rules

**The Quiet Elevation Rule.** A shadow says "this floats above the page", and in
this app only three things do: the palette, the filter dialog and the ⌘K button.
A resting panel gets `xs` or nothing. New shadow tokens are not part of this
system.

## Shapes

Soft, not round. Radii run 4px (`xs`) → 6px (`sm`) → 8px (`md`, every button and
small control) → 12px (`lg`, every card) → 14px (`xl`, the search field and the
row action button) → 18px (`2xl`, dialogs); `rounded-full` is reserved for
category chips, status badges and the meter. Timetable blocks have no radius at
all: they are bands on a grid, marked by a 3px leading accent rule.

Borders come in one weight — **1px** Neutral 200/700 — for cards, dividers,
dialogs and controls, plus the **3px** leading accent of a timetable block. The
prerequisite tree is the one geometric departure: a hand-drawn SVG graph with
`rx=8` nodes and 1.5px Neutral 300 edges.

## Components

Everything is Tailwind utility composition; the shared vocabulary lives as eight
global classes in `src/app.css` (`.card`, `.btn-primary`, `.btn-quiet`,
`.btn-text`, `.u-data`, `.eyebrow`, `.spine`/`.spine-min`, `.row-rule`,
`.meter`). Character line for all of it: **quiet at rest, obvious on contact.**

### Buttons

Three, and no more:

- **Primary (`.btn-primary`):** solid Accent 600, white text, 8px radius, `0.5rem 0.875rem`, 0.875rem/500. One per panel at most — the filter dialog's Apply, the calendar export. Hover deepens to Accent 700.
- **Quiet (`.btn-quiet`):** the default secondary action — Neutral 100 fill, Neutral 700 text, no border, 8px radius, `0.3125rem 0.625rem`, 0.75rem/500. Hover deepens the fill one step. A tinted fill reads as a button at a glance without adding another line to a dense list, which is why the old bordered variant is gone. Copy-link, conflict-free solver, undo, clear, and the three actions inside `Details`.
- **Text (`.btn-text`):** no box at all until hover, when it takes the accent. Disclosures only — `Details`, `Show description`, `Show more`, `How to import?`.
- **Row action:** the single 44×44 control on the right of a catalogue row. Solid accent with a `+` when the section is not selected; Neutral 100 with a `−`, going Scarcity Full on hover, when it is. It is the only always-visible action on a card.
- **Focus:** every control inherits one global treatment — a 2px Accent 500 outline at 2px offset. Do not add per-component focus rings; the two that exist (the search input and the semester select) are the exceptions, not the pattern.
- **Touch:** every icon control is at least a 44×44 target; inline text controls get `min-h-6`.

### Chips

- **Category chips:** the department codes above the catalogue — mono 0.75rem/500 in a Neutral 100 pill, folded to a single row with a `Show more` toggle *beside* the row, never floating over it.
- **Instructor chips:** `.btn-quiet` with `rounded-full`.
- **Status badges:** `rounded-full`, `-50` fill with `-700` text, 0.6875rem/500. Exactly two exist: "taken" (accent) and "Conflict" (scarcity full). A badge is an alert, not a label; if it is not urgent it is text.

### Cards / Containers

- **Template (`.card`):** white surface, 1px Neutral 200 border, 12px radius, `shadow-xs`. Dark mode: Neutral 800 on a softened Neutral 700 border, no shadow.
- **Internal structure:** `divide-y` in Neutral 100 (dark: Neutral 700 at 60%) — one step lighter than the outer border, so rows read as one object rather than as a stack of cards.
- **Internal padding:** `1rem` horizontal; `0.75rem` vertical for a header or course row, `0.5rem` for a compact list row. Rows hover to Neutral 50 (dark: Neutral 900 at 40%).

This one template is the catalogue, the selected-course panel, the instructor
panel and the timetable frame. New panels use it rather than inventing a
container — and a panel that renders *inside* another one is a flush section
with no border of its own: one border around the whole thing, not two.

### The course row (signature layout)

A row is read top to bottom in one pass:

1. **Identity** — section key (mono 600) + course name, with a "taken" or "Conflict" badge if either applies.
2. **The practical line** — instructor, schedule in real clock times, rooms, credits. Separated by whitespace, not by dots: one less mark per row, times 3140.
3. **Seats** — the count, "N left" or FULL, the scrape timestamp, and the occupancy meter.
4. **Alerts, only if real** — missing prerequisites, a final-exam clash, the exam schedule once the registrar publishes it.
5. **`Details`** — one disclosure holding prerequisites and their tree, quota restrictions, cross-listings, offering history, ECTS, the catalogue description, and the three secondary actions (mark as taken, official course page, report incorrect data) as *labelled* buttons rather than bare icons.

Everything above the fold answers "can I get it and does it fit". Everything
below it is reference.

### Inputs / Fields

- **Search:** 14px radius, white fill, 1px Neutral 200, `shadow-xs`, `2.75rem` insets for the icon and the clear button, Neutral 400 placeholder. Focus shifts the border to Accent 500 and adds a 1px accent ring.
- **Semester select:** `appearance-none` mono control with a manually placed chevron in Neutral 400; it compacts a step below `sm` so the app title never has to truncate on a 390px phone.
- **Checkboxes:** `appearance-none`, 5–8px radius, 1px Neutral 300 border. A single option fills solid Accent 600 when checked; the timetable day/hour grid fills Accent 200 instead, because a 6×14 grid of solid accent is a wall, and "this slot is shown" is the default state rather than an assertion.
- **Command palette input:** borderless except for a bottom hairline, 1rem, `1rem` padding — the panel's own border and shadow do the containing.
- **Error / Disabled:** inputs have no error state; validation lives in the data, not the form. Disabled controls use the native attribute with `opacity: 0.45`.
- **Empty:** a state with nothing in it still owes the reader a sentence and a way out — the query echoed verbatim, what was searched, and the controls that undo it, centred in a card. A `role="list"` with no items is not an empty state, it is a bug.

### Navigation

There is no nav bar. The top bar holds the title, the semester select and the
EN/TR segmented control (the active half is a raised white pill, and carries
`aria-pressed`). Navigation happens through search, the ⌘K palette, and URL
state.

### The Occupancy Meter (signature component)

The one loud element, and the reason the design exists. A rounded 3px rule under
a section's seat count, `max-width: 11rem`, track in Neutral 200 (dark: Neutral
700 at 80%). Its fill is `--fill` (current/quota) in `currentColor`, so the
wrapper's text colour *is* the meter colour: Scarcity Open below 85%, Scarcity
Filling at ≥85%, Scarcity Full when full or over-enrolled. The point is the tail:
an over-enrolled section spills past the end of the track into a `--over` segment
drawn as a 45° hatch, instead of clamping at 100% and quietly lying about a full
section. Fill and tail animate at 220ms `cubic-bezier(0.2, 0, 0, 1)`, and not at
all under `prefers-reduced-motion`. It is `aria-hidden`: the numbers beside it
carry the same fact to a screen reader.

### Command Palette

A 42rem panel at `10vh` over a lightly blurred Neutral 900/40 backdrop: 1px
border, 18px radius, `shadow-lg`. Sticky mono group headers on Neutral 50, and
result rows whose *only* active treatment is an Accent 50 fill — keyboard-active
and hover share one visual state, so there is never a second highlight competing
with the caret.

## Do's and Don'ts

### Do:

- **Do** express interaction only in the accent, and let the global 2px Accent 500 `:focus-visible` outline be the house focus.
- **Do** set every machine-produced value in `.u-data` (mono + tabular figures) and every human label in the grotesk.
- **Do** reuse `.card` for any new panel, and `.btn-primary` / `.btn-quiet` / `.btn-text` for any new control.
- **Do** separate surfaces with whitespace, a hairline or a tonal step, in that order.
- **Do** put anything a student does not need in the first two seconds behind the row's `Details` disclosure — and label it there, rather than shipping another bare icon.
- **Do** keep small text at Neutral 500 on the ground and Neutral 400 on dark, and re-run the axe gate in both schemes after touching a colour.
- **Do** state absent data as absent: italic "unpublished", a greyed note for unknown prerequisites, "no data" rather than a zero.
- **Do** honour `prefers-reduced-motion`: the global reset kills transitions, and the meter opts out explicitly.

### Don't:

- **Don't** introduce a second accent hue into the chrome. One accent, one meaning.
- **Don't** spend green, amber or red on anything that is not capacity, staleness or a clash. Credits, ECTS and counts stay neutral — a count is data, not an alert.
- **Don't** add a second always-visible action to a catalogue row. One row, one button; the rest go under `Details`.
- **Don't** reach for a shadow to separate two resting surfaces. Only the palette, the filter dialog and the ⌘K button float.
- **Don't** float a control over the content it is describing — the department fold's toggle sits beside the chips precisely because it used to cover them.
- **Don't** use a `title` tooltip as the only copy of something a touch user needs; put it in the text, or under `Details`.
