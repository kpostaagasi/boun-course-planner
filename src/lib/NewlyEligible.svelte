<script lang="ts">
  import { onMount } from "svelte";
  import {
    getCurSemesterData,
    getCompletedCourseSet,
    getPrereqsAll,
    getOfferings,
    loadCompleted,
    loadPrereqs,
    loadOfferings,
    getCurrentSemester,
  } from "./globalState.svelte";
  import { sortTermsNewestFirst } from "./roadmapLogic";
  import { getEligibility } from "./eligibility";
  import { baseCode } from "./courseKey";
  import { t, getLang } from "./i18n.svelte";

  const SEASON: Record<string, { en: string; tr: string }> = {
    "1": { en: "Fall", tr: "Güz" },
    "2": { en: "Spring", tr: "Bahar" },
    "3": { en: "Summer", tr: "Yaz" },
  };

  type NewlyCourse = {
    code: string;
    name: string;
    missingCount: number;
  };

  let open = $state(false);
  let selectedTerm = $state("now"); // "now" or a file key "YYYY-YYYY-T"
  let availableTerms = $state<string[]>([]);

  // Idempotent loaders; also fired from App.svelte onMount
  loadCompleted();
  loadPrereqs();
  loadOfferings();

  onMount(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/semesters.json`);
      if (!res.ok) return;
      const allTerms: string[] = await res.json();
      if (!Array.isArray(allTerms)) return;
      // semesters.json uses "YYYY/YYYY-T"; offerings.json uses the file-key
      // form "YYYY-YYYY-T", so normalize for lookup.
      // Keep only terms at/below current semester; newest first.
      const current = getCurrentSemester();
      const pool = (
        current && current.length > 0
          ? allTerms.filter((term) => term.replace("/", "-") <= current)
          : [...allTerms]
      ).map((term) => term.replace("/", "-"));
      availableTerms = sortTermsNewestFirst(pool);
    } catch {
      // semesters.json unavailable: select shows only "Now"
    }
  });

  /** Display label for a file key "YYYY-YYYY-T", e.g. "2026/2027 Fall". */
  function termDisplay(fileKey: string): string {
    const m = /^(\d{4})-(\d{4})-(\d)$/.exec(fileKey);
    if (!m) return fileKey;
    const season = SEASON[m[3]];
    const label = season ? season[getLang()] : `Term ${m[3]}`;
    return `${m[1]}/${m[2]} ${label}`;
  }

  /**
   * Courses that currently miss prerequisites but would become eligible if
   * every course offered in the selected term were completed.
   */
  const newlyEligible = $derived.by<NewlyCourse[]>(() => {
    const curData = getCurSemesterData();
    if (!curData) return [];
    const prereqs = getPrereqsAll();
    const offerings = getOfferings();

    // The "now" set is the live backing store: allocation-free, and `has()`
    // tracks a single member rather than the whole collection.
    const nowCompleted = getCompletedCourseSet();

    // The hypothetical set must stay a private copy — it is mutated below with
    // everything the selected term offered.
    const completedSet = new Set(nowCompleted);
    if (selectedTerm !== "now" && offerings) {
      // offerings.json is keyed by course code -> invert: which courses were
      // offered in the selected term?
      for (const [code, terms] of Object.entries(offerings)) {
        if (terms.includes(selectedTerm)) completedSet.add(code);
      }
    }

    // Current semester course map is keyed by section name ("CMPE150.01");
    // deduplicate to base codes and remember the display name.
    const seen = new Set<string>();
    const out: NewlyCourse[] = [];
    for (const [sectionName, info] of Object.entries(curData)) {
      const base = baseCode(sectionName);
      if (seen.has(base)) continue;
      seen.add(base);

      const nowStatus = getEligibility(base, nowCompleted, prereqs);
      if (nowStatus.status !== "missing-prereq") continue;
      const thenStatus = getEligibility(base, completedSet, prereqs);
      if (thenStatus.status !== "eligible") continue;

      out.push({
        code: base,
        name: String((info as { name?: unknown })?.name ?? ""),
        missingCount: nowStatus.missing.length + (nowStatus.moreMissing ? 1 : 0),
      });
    }
    out.sort((a, b) => a.code.localeCompare(b.code));
    return out;
  });
</script>

<div
  class="mt-4 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
>
  <button
    type="button"
    class="flex w-full cursor-pointer items-baseline px-4 py-2.5 text-left"
    onclick={() => (open = !open)}
  >
    <span class="text-[0.9375rem] font-semibold">{t("newly.title")}</span>
    <span class="u-data ml-2 text-[0.6875rem] text-zinc-600 dark:text-zinc-400"
      >{newlyEligible.length}</span
    >
    <span class="u-data ml-auto text-xs text-zinc-600 dark:text-zinc-400"
      >{open ? "−" : "+"}</span
    >
  </button>
  {#if open}
    <div class="flex items-center gap-2 border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
      <label class="text-sm text-zinc-600 dark:text-zinc-300" for="newly-term-select">
        {t("newly.completedAsOf")}
      </label>
      <select
        id="newly-term-select"
        class="u-data cursor-pointer rounded-md border border-zinc-300 bg-white px-2 py-1 text-[0.8125rem] transition-colors hover:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:border-blue-400"
        bind:value={selectedTerm}
      >
        <option value="now">{t("newly.now")}</option>
        {#each availableTerms as term (term)}
          <option value={term}>{termDisplay(term)}</option>
        {/each}
      </select>
    </div>
    <div class="divide-y divide-zinc-100 dark:divide-zinc-700/60">
      {#if newlyEligible.length === 0}
        <div class="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("newly.empty")}
        </div>
      {:else}
        {#each newlyEligible as course (course.code)}
          <div class="flex flex-wrap items-baseline gap-2 px-4 py-2">
            <span class="u-data text-sm font-semibold">{course.code}</span>
            <span class="text-sm text-zinc-600 dark:text-zinc-300">{course.name}</span>
            <!-- Missing-prereq count is a real blocker: amber, per the colour rule
                 (red is reserved for full/clash, this is "not yet"). -->
            <span class="u-data ml-auto text-[0.6875rem] text-amber-500 dark:text-amber-300">
              {t("newly.missingPrereqs").replace("{n}", String(course.missingCount))}
            </span>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>
