<script lang="ts">
  import {
    getCurSemesterData,
    addCourse,
    getSelectedCourseNames,
    loadQuota,
    getQuotaSections,
  } from "./globalState.svelte";
  import { t } from "./i18n.svelte";
  import {
    buildPaletteEntries,
    searchPalette,
    groupPaletteResults,
    describeSchedule,
    uniqueRooms,
    DAY_NAMES,
  } from "./paletteSearch";
  import type { PaletteEntry, PaletteGroup } from "./paletteSearch";

  /** Result budget, in courses: every matching section of a shown course is shown. */
  const COURSE_LIMIT = 8;

  type RenderGroup = PaletteGroup & { offset: number };

  let open = $state(false);
  let query = $state("");
  let activeIndex = $state(0);
  let dialogEl: HTMLDivElement | undefined = $state();
  let listEl: HTMLUListElement | undefined = $state();
  let restoreFocusTo: HTMLElement | null = null;

  // ---- Optional quota dataset -------------------------------------------
  // quota.json is scraped separately from the semester data and may be absent
  // entirely (it is not committed for older terms, and a fresh checkout may
  // predate the scrape). Everything below degrades to "no seat badges" on a
  // 404, a network error, or a shape we do not recognise.
  //
  // globalState owns the fetch, the term gate and the scrape timestamp. This is
  // a read-only view: getQuotaSections() already returns null unless the file's
  // meta.term matches the term being browsed, so one term's enrolment can never
  // be attributed to another.
  const activeQuotaSections = $derived(getQuotaSections());

  // Entries are rebuilt only when the semester dataset or the quota map
  // changes, not on every keystroke: a live term holds 3000+ sections.
  const entries: PaletteEntry[] = $derived.by(() =>
    buildPaletteEntries(getCurSemesterData(), activeQuotaSections),
  );

  const results: PaletteEntry[] = $derived.by(() => {
    if (!open) return [];
    return searchPalette(entries, query, COURSE_LIMIT);
  });

  // Grouped view over the flat result list; the flat list stays the
  // keyboard-navigation index, so each group carries its starting offset.
  const groups: RenderGroup[] = $derived.by(() => {
    let offset = 0;
    return groupPaletteResults(results).map((group) => {
      const withOffset = { ...group, offset };
      offset += group.sections.length;
      return withOffset;
    });
  });

  // Derived rather than clamped in place: the result list can shrink under an
  // active selection (semester switch, quota arriving) and a stale index must
  // never make Enter add the wrong section.
  const active = $derived(
    results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1),
  );

  const selectedKeys = $derived(new Set(getSelectedCourseNames()));

  const dayLabels = $derived.by(() => {
    const labels: Record<string, string> = {};
    for (const code of Object.keys(DAY_NAMES)) {
      labels[code] = t(`day.${DAY_NAMES[code]}`);
    }
    return labels;
  });

  function scheduleText(entry: PaletteEntry): string {
    return describeSchedule(entry, {
      dayLabels,
      unscheduled: t("palette.unscheduled"),
    });
  }

  function seatText(entry: PaletteEntry): string {
    const quota = entry.quota;
    if (quota.status === "unknown") return "";
    if (quota.status === "full") return t("palette.full");
    return `${quota.left} ${t("palette.seatsLeft")}`;
  }

  // Rows carry a lot of small visual bits; give assistive tech one sentence
  // with the same information instead of making it stitch spans together.
  function rowLabel(entry: PaletteEntry): string {
    const parts = [entry.courseName, entry.title, scheduleText(entry)];
    if (entry.instructor !== "") parts.push(entry.instructor);
    if (entry.credits !== null) {
      parts.push(`${entry.credits} ${t("palette.credits")}`);
    }
    const seats = seatText(entry);
    if (seats !== "") parts.push(seats);
    if (selectedKeys.has(entry.courseName)) {
      parts.push(t("palette.alreadyAdded"));
    }
    return parts.join(", ");
  }

  function openPalette() {
    restoreFocusTo =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    open = true;
    query = "";
    activeIndex = 0;
    void loadQuota();
  }

  function close() {
    open = false;
    restoreFocusTo?.focus();
    restoreFocusTo = null;
  }

  function focusOnOpen(node: HTMLInputElement) {
    node.focus();
  }

  function onBackdropClick(e: MouseEvent) {
    // Only a click on the backdrop itself closes; clicks inside the panel
    // (placing the caret in the input, for one) bubble up to here too.
    if (e.target === e.currentTarget) close();
  }

  function pick(entry: PaletteEntry) {
    if (!selectedKeys.has(entry.courseName)) {
      addCourse(entry.courseName);
    }
    close();
  }

  function onKeydown(e: KeyboardEvent) {
    // Single global listener (see 5164190: a second document-level listener
    // made Cmd+K toggle twice). Esc is handled here so it works wherever
    // focus sits while the palette is open.
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (open) close();
      else openPalette();
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  const FOCUSABLE =
    'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])';

  // The dialog is not rendered inside an inert wrapper, so without this Tab
  // walks straight out into the page behind the overlay.
  function trapTab(e: KeyboardEvent) {
    if (!dialogEl) return;
    e.preventDefault();
    const nodes = Array.from(
      dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((node) => !node.hasAttribute("disabled"));
    if (nodes.length === 0) return;
    const current =
      document.activeElement instanceof HTMLElement
        ? nodes.indexOf(document.activeElement)
        : -1;
    const next = e.shiftKey
      ? nodes[(current <= 0 ? nodes.length : current) - 1]
      : nodes[current === -1 || current === nodes.length - 1 ? 0 : current + 1];
    next.focus();
  }

  function onDialogKeydown(e: KeyboardEvent) {
    if (e.key === "Tab") {
      trapTab(e);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(active + 1, results.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(active - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = results[active];
      if (entry) pick(entry);
    }
  }

  $effect(() => {
    // Keep the highlighted result in view during keyboard navigation. Queried
    // by marker instead of by child index: the list also holds group headers.
    if (listEl && open && active >= 0) {
      listEl
        .querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: "nearest" });
    }
  });
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <div
    class="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-[10vh]"
    onclick={onBackdropClick}
    role="presentation"
  >
    <!-- tabindex makes the panel a valid programmatic focus target and keeps
         the keydown handler off the a11y warning list -->
    <div
      bind:this={dialogEl}
      tabindex="-1"
      onkeydown={onDialogKeydown}
      class="w-full max-w-2xl mx-4 bg-white dark:bg-zinc-800 shadow-xl focus:outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={t("palette.title")}
      data-testid="palette-dialog"
    >
      <input
        bind:value={query}
        oninput={() => (activeIndex = 0)}
        class="w-full p-3 text-lg bg-transparent border-b border-zinc-200 dark:border-zinc-600 focus:outline-none text-zinc-900 dark:text-white"
        placeholder={t("palette.placeholder")}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="palette-listbox"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `palette-opt-${active}` : undefined}
        data-testid="palette-input"
        use:focusOnOpen
      />
      {#if results.length > 0}
        <ul
          bind:this={listEl}
          id="palette-listbox"
          role="listbox"
          aria-label={t("palette.results")}
          class="max-h-96 overflow-y-auto"
        >
          {#each groups as group (group.code)}
            <!-- Course header. Sections of one course are always emitted
                 together and in full, so the header labels a contiguous run. -->
            <li
              role="presentation"
              class="sticky top-0 flex items-baseline gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700"
            >
              <span class="font-semibold text-sm text-zinc-900 dark:text-white shrink-0"
                >{group.code}</span
              >
              <span class="text-xs text-zinc-600 dark:text-zinc-300 break-all"
                >{group.title}</span
              >
              {#if group.sections.length > 1}
                <span
                  class="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >{group.sections.length} {t("palette.sections")}</span
                >
              {/if}
            </li>
            {#each group.sections as entry, i (entry.courseName)}
              {@const idx = group.offset + i}
              {@const rooms = uniqueRooms(entry)}
              <li
                id={`palette-opt-${idx}`}
                role="option"
                aria-selected={idx === active}
                aria-label={rowLabel(entry)}
                data-testid="palette-row"
                data-section-key={entry.courseName}
                data-scheduled={entry.scheduled}
                data-active={idx === active}
                class="px-3 py-2 cursor-pointer {idx === active
                  ? 'bg-blue-100 dark:bg-blue-900'
                  : ''}"
                onmouseenter={() => (activeIndex = idx)}
                onclick={() => pick(entry)}
                onkeydown={onDialogKeydown}
              >
                <div class="flex items-baseline gap-2">
                  <span
                    class="font-mono text-sm text-zinc-900 dark:text-white shrink-0"
                    >{entry.courseName}</span
                  >
                  {#if entry.title !== group.title}
                    <span class="text-xs text-zinc-500 dark:text-zinc-400 break-all"
                      >{entry.title}</span
                    >
                  {/if}
                  {#if selectedKeys.has(entry.courseName)}
                    <span
                      class="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-green-700 dark:text-green-400"
                      >✓ {t("palette.alreadyAdded")}</span
                    >
                  {:else if entry.quota.status !== "unknown"}
                    <span
                      class="ml-auto shrink-0 text-[10px] uppercase tracking-wide {entry
                        .quota.status === 'full'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-zinc-500 dark:text-zinc-400'}"
                      data-testid="palette-seats">{seatText(entry)}</span
                    >
                  {/if}
                </div>
                <div
                  class="flex items-baseline gap-2 text-xs text-zinc-500 dark:text-zinc-400"
                >
                  <span
                    data-testid="palette-when"
                    class="shrink-0 {entry.scheduled ? '' : 'italic'}"
                    >{scheduleText(entry)}</span
                  >
                  <span class="truncate">{entry.instructor}</span>
                  {#if rooms.length > 0}
                    <span class="shrink-0 hidden sm:inline">{rooms.join(", ")}</span>
                  {/if}
                  {#if entry.credits !== null}
                    <span class="ml-auto shrink-0"
                      >{entry.credits} {t("palette.credits")}</span
                    >
                  {/if}
                </div>
              </li>
            {/each}
          {/each}
        </ul>
      {:else if query.trim()}
        <div class="p-3 text-sm text-zinc-500 dark:text-zinc-400">{t("palette.noResults")}</div>
      {/if}
      <div class="px-3 py-1.5 text-xs text-zinc-400 dark:text-zinc-500 border-t border-zinc-200 dark:border-zinc-600">
        ↑↓ {t("palette.navigate")} · ⏎ {t("palette.add")} · Esc {t("palette.close")}
      </div>
    </div>
  </div>
{/if}

<!-- Floating hint button so mobile users can reach the palette too -->
<button
  type="button"
  class="u-data fixed bottom-4 right-4 z-40 h-10 w-10 rounded-md border border-zinc-300 bg-white text-[0.6875rem] font-semibold text-zinc-500 shadow-sm transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-blue-400 dark:hover:text-blue-300 cursor-pointer"
  title={t("palette.openTitle")}
  aria-label={t("palette.openTitle")}
  onclick={openPalette}
>⌘K</button>
