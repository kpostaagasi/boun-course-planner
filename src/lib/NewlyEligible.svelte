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
      // offerings.json is keyed by course code → invert: which courses were
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

<div class="mt-4 shadow bg-white dark:bg-zinc-800 dark:text-white rounded-lg overflow-hidden shrink-0">
  <button
    type="button"
    class="w-full py-2 px-4 bg-zinc-50 dark:bg-zinc-700 flex items-center cursor-pointer text-left"
    onclick={() => (open = !open)}
  >
    <span class="font-medium">{t("newly.title")}</span>
    <span
      class="ml-2 text-xs bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 border border-blue-600/50 dark:border-blue-400/50 rounded-full px-1"
      >{newlyEligible.length}</span
    >
    <span class="ml-auto text-xs text-zinc-500 dark:text-zinc-400">{open ? "−" : "+"}</span>
  </button>
  {#if open}
    <div class="py-2 px-4 flex items-center gap-2">
      <label class="text-sm text-zinc-600 dark:text-zinc-300" for="newly-term-select">
        {t("newly.completedAsOf")}
      </label>
      <select
        id="newly-term-select"
        class="text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 cursor-pointer"
        bind:value={selectedTerm}
      >
        <option value="now">{t("newly.now")}</option>
        {#each availableTerms as term (term)}
          <option value={term}>{termDisplay(term)}</option>
        {/each}
      </select>
    </div>
    <div class="divide-y divide-gray-200 dark:divide-zinc-500">
      {#if newlyEligible.length === 0}
        <div class="py-2 px-4 bg-zinc-50 dark:bg-zinc-700 text-sm text-zinc-600 dark:text-zinc-300">
          {t("newly.empty")}
        </div>
      {:else}
        {#each newlyEligible as course (course.code)}
          <div class="py-2 px-4 flex items-center gap-2 flex-wrap">
            <span class="font-medium">{course.code}</span>
            <span class="text-sm text-zinc-600 dark:text-zinc-300">{course.name}</span>
            <span
              class="ml-auto text-xs border rounded-full px-1 bg-red-50 text-red-700 border-red-700/50 dark:bg-red-900 dark:text-red-300 dark:border-red-300/50"
            >
              {t("newly.missingPrereqs").replace("{n}", String(course.missingCount))}
            </span>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>
