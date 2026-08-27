<script module lang="ts">
  import { getSemesterData } from "./globalState.svelte";
  import { buildInstructorIndex } from "./instructors";
  import type { InstructorIndex, SectionRecord, TermDataset } from "./instructors";
  import { sortTermsNewestFirst } from "./roadmapLogic";

  /**
   * How many terms the teaching history covers, current term included.
   *
   * The honest limitation, stated here and in the UI: only the *selected* term
   * is part of the app payload. The whole archive is 25 term files — 10.5 MB of
   * raw JSON, 1.3 MB gzipped — so "full history" would mean pulling all of it
   * to answer one question, and `offerings.json`, the one file that does span
   * every term, records which course was offered when, not who taught it. So
   * the panel fetches a bounded window of the most recent terms when it opens
   * and labels every count with the window it was computed over. A term already
   * in `semesterData` (the user switched to it) costs nothing extra.
   *
   * Measured cost of five: 2.4 MB raw / 292 KB gzipped, of which the current
   * term is already in memory, so an explicit, user-initiated panel open pulls
   * ~220 KB over the wire. It also spans two academic years, which is the
   * horizon a student planning next term actually cares about.
   */
  const HISTORY_TERMS = 5;

  /** Courses listed in the history block before the tail is summarised. */
  const HISTORY_COURSE_LIMIT = 8;

  /** One index per term, shared by every panel instance; term files never change. */
  const historyCache = new Map<string, Promise<InstructorIndex>>();

  async function fetchTerm(
    term: string,
  ): Promise<Record<string, SectionRecord> | null> {
    const loaded = getSemesterData()[term];
    if (loaded) return loaded as Record<string, SectionRecord>;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/${term}.json`);
      if (!res.ok) return null;
      return (await res.json()) as Record<string, SectionRecord>;
    } catch {
      return null;
    }
  }

  /**
   * The most recent `HISTORY_TERMS` terms at or below `term`, newest first.
   * Falls back to the current term alone when semesters.json is unreachable —
   * a one-term index is still correct, it just claims less.
   */
  async function historyTerms(term: string): Promise<string[]> {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/semesters.json`);
      if (res.ok) {
        const raw: unknown = await res.json();
        if (Array.isArray(raw)) {
          // semesters.json uses "YYYY/YYYY-T"; data files use "YYYY-YYYY-T".
          // Both forms are fixed-width, so a string compare orders them.
          const pool = raw
            .map((entry: unknown) => String(entry).replace("/", "-"))
            .filter((key: string) => key <= term && key !== term);
          return [term, ...sortTermsNewestFirst(pool)].slice(0, HISTORY_TERMS);
        }
      }
    } catch {
      // offline or missing: current term only
    }
    return [term];
  }

  function historyIndexFor(term: string): Promise<InstructorIndex> {
    const cached = historyCache.get(term);
    if (cached) return cached;
    const pending = (async () => {
      const terms = await historyTerms(term);
      const datasets = await Promise.all(
        terms.map(async (key) => {
          const data = await fetchTerm(key);
          return data ? ({ term: key, data } satisfies TermDataset) : null;
        }),
      );
      // Order matters: the current term must stay primary, so a failed archive
      // fetch is dropped rather than shifting the window.
      return buildInstructorIndex(
        datasets.filter((entry): entry is TermDataset => entry !== null),
      );
    })();
    historyCache.set(term, pending);
    return pending;
  }
</script>

<script lang="ts">
  import { instructorsForCourse } from "./instructors";
  import type { InstructorEntry } from "./instructors";
  import { describeSchedule, DAY_NAMES } from "./paletteSearch";
  import { t } from "./i18n.svelte";

  let {
    entry,
    term,
    onclear,
  }: {
    entry: InstructorEntry;
    term: string;
    onclear: () => void;
  } = $props();

  let history = $state<InstructorIndex | null>(null);
  let loading = $state(true);

  $effect(() => {
    const key = term;
    if (!key) return;
    let cancelled = false;
    history = null;
    loading = true;
    historyIndexFor(key).then((index) => {
      if (cancelled) return;
      history = index;
      loading = false;
    });
    return () => {
      cancelled = true;
    };
  });

  const dayLabels = $derived.by(() => {
    const labels: Record<string, string> = {};
    for (const code of Object.keys(DAY_NAMES)) {
      labels[code] = t(`day.${DAY_NAMES[code]}`);
    }
    return labels;
  });

  /** Terms actually indexed; 1 until the archive lands, never a guess. */
  const scope = $derived(history ? history.terms.length : 1);

  /**
   * The same person seen over the loaded window. Until the archive resolves,
   * the current-term entry stands in — same shape, one term of evidence.
   */
  const person = $derived(
    (history ? history.byKey[entry.key] : null) ?? entry,
  );

  // A prolific supervisor accumulates 20+ directed-reading and thesis codes;
  // the panel sits above the catalogue, so the tail is summarised rather than
  // rendered. Most terms first is what makes the visible head the useful part.
  // Each row carries the reverse lookup — who else has taught that course
  // inside the loaded window — resolved once here rather than per render.
  const ranked = $derived.by(() =>
    person.courses
      .slice()
      .sort(
        (a, b) =>
          b.terms.length - a.terms.length ||
          (a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
      ),
  );
  const rows = $derived.by(() =>
    ranked.slice(0, HISTORY_COURSE_LIMIT).map((course) => ({
      course,
      others: history
        ? instructorsForCourse(history, course.code)
            .filter((credit) => credit.key !== person.key)
            .slice(0, 3)
        : [],
    })),
  );
  const hiddenCourses = $derived(ranked.length - rows.length);
</script>

<div
  class="mt-4 shadow bg-white dark:bg-zinc-800 dark:text-white rounded-lg overflow-hidden shrink-0"
  data-testid="instructor-panel"
>
  <div
    class="py-2 px-4 bg-zinc-50 dark:bg-zinc-700 flex items-center gap-2 flex-wrap"
  >
    <span class="text-xs text-zinc-500 dark:text-zinc-400"
      >{t("instructor.title")}</span
    >
    <span class="font-medium" data-testid="instructor-name">{entry.display}</span>
    <span
      class="text-xs bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 border border-blue-600/50 dark:border-blue-400/50 rounded-full px-1"
      title={t("instructor.sections", { n: entry.sections.length })}
    >
      {entry.sections.length}
    </span>
    <button
      type="button"
      class="ml-auto text-xs text-blue-600 dark:text-blue-400 cursor-pointer"
      data-testid="instructor-clear"
      onclick={onclear}
    >
      {t("instructor.clear")}
    </button>
  </div>

  <div class="py-1 px-4 text-xs text-zinc-500 dark:text-zinc-400">
    {t("instructor.scopeNote")}
    {#if entry.variants.length > 1}
      <!-- The registrar spells some people several ways across terms; showing
           the alternatives is how a student recognises their own professor. -->
      <span class="ml-1"
        >{t("instructor.alsoListedAs", {
          names: entry.variants.slice(1).join(", "),
        })}</span
      >
    {/if}
  </div>

  <!-- Every entry reaching this panel comes from the current term's index, so
       there is always at least one section to list. -->
  <div class="divide-y divide-gray-200 dark:divide-zinc-500">
    {#each entry.sections as section (section.sectionKey)}
      <div
        class="py-2 px-4 flex items-baseline gap-2 flex-wrap"
        data-testid="instructor-section"
      >
        <span class="font-medium">{section.sectionKey}</span>
        <span class="text-sm text-zinc-600 dark:text-zinc-300"
          >{section.name}</span
        >
        <span
          class="ml-auto text-sm text-zinc-500 dark:text-zinc-400"
          data-testid="instructor-schedule"
        >
          {describeSchedule(section, {
            dayLabels,
            // Same concept, same wording as the palette's unscheduled rows;
            // 42.5% of sections have no meeting time at all.
            unscheduled: t("palette.unscheduled"),
          })}
        </span>
        {#if section.rooms.length > 0}
          <span class="text-sm text-zinc-500 dark:text-zinc-400"
            >🏠 {section.rooms.join(" ")}</span
          >
        {/if}
      </div>
    {/each}
  </div>

  <div
    class="py-2 px-4 bg-zinc-50 dark:bg-zinc-700 border-t border-gray-200 dark:border-zinc-500"
    data-testid="instructor-history"
  >
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-sm font-medium">{t("instructor.history")}</span>
      <span class="text-xs text-zinc-500 dark:text-zinc-400">
        {loading
          ? t("instructor.historyLoading")
          : scope > 1
            ? t("instructor.historyScope", { n: scope })
            : t("instructor.historyCurrentOnly")}
      </span>
    </div>
    <div class="mt-1 divide-y divide-gray-200 dark:divide-zinc-600">
      {#each rows as row (row.course.code)}
        <div
          class="py-1 flex items-baseline gap-2 flex-wrap"
          data-testid="instructor-history-course"
        >
          <span class="text-sm font-medium">{row.course.code}</span>
          <span class="text-sm text-zinc-600 dark:text-zinc-300"
            >{row.course.name}</span
          >
          {#if !loading}
            <!-- No counts before the window is known: "1 of 1 terms" during
                 the fetch would understate a person's real history. -->
            <span class="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
              {t("instructor.termsTaught", {
                n: row.course.terms.length,
                m: scope,
              })}
            </span>
          {/if}
          {#if row.others.length > 0}
            <span class="w-full text-xs text-zinc-500 dark:text-zinc-400">
              {t("instructor.alsoTaughtBy")}
              {row.others.map((credit) => credit.display).join(", ")}
            </span>
          {/if}
        </div>
      {/each}
      {#if hiddenCourses > 0}
        <div class="py-1 text-xs text-zinc-500 dark:text-zinc-400">
          {t("instructor.moreCourses", { n: hiddenCourses })}
        </div>
      {/if}
    </div>
  </div>
</div>
