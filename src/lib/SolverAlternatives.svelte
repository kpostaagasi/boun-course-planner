<script lang="ts">
  import {
    getSolverPrefs,
    getSolverAlternatives,
    getSolverAlternativeIndex,
    setSolverAlternativeIndex,
    getSolverAlternativesOutcome,
    runSolverAlternatives,
    applySolverAlternative,
    closeSolverAlternatives,
    getSolverAlternativesTruncated,
  } from "./globalState.svelte";
  import { DAY_LABEL_KEYS } from "./timetableLayout";
  import { t } from "./i18n.svelte";

  const prefs = getSolverPrefs();
  const alternatives = $derived(getSolverAlternatives());
  const currentIndex = $derived(getSolverAlternativeIndex());
  const outcome = $derived(getSolverAlternativesOutcome());

  const days = ["M", "T", "W", "Th", "F", "St"];
  const truncated = $derived(getSolverAlternativesTruncated());

  function toggleDay(d: string) {
    if (prefs.freeDays.includes(d)) {
      prefs.freeDays = prefs.freeDays.filter((x) => x !== d);
    } else {
      prefs.freeDays = [...prefs.freeDays, d];
    }
  }

  function handleFind() {
    runSolverAlternatives();
  }

  function handlePrev() {
    if (alternatives && currentIndex > 0) {
      setSolverAlternativeIndex(currentIndex - 1);
    }
  }

  function handleNext() {
    if (alternatives && currentIndex < alternatives.length - 1) {
      setSolverAlternativeIndex(currentIndex + 1);
    }
  }

  function handleApply() {
    applySolverAlternative();
  }
</script>

<div class="mt-4 border border-zinc-300 dark:border-zinc-700 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-800/50">
  <h3 class="text-sm font-semibold mb-3">{t("solver.altTitle")}</h3>
  
  <div class="flex flex-col gap-3 text-sm">
    <div class="flex items-center flex-wrap gap-2">
      <span class="mr-2 font-medium">{t("solver.freeDays")}:</span>
      {#each days as d, i}
        <label class="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.freeDays.includes(d)}
            onchange={() => toggleDay(d)}
            class="rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
          />
          <span class="text-zinc-600 dark:text-zinc-400">{t(DAY_LABEL_KEYS[i])}</span>
        </label>
      {/each}
    </div>

    <div class="flex items-center gap-6 flex-wrap">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          bind:checked={prefs.noEarly}
          class="rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
        />
        <span>{t("solver.noEarly")}</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          bind:checked={prefs.fewerDays}
          class="rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
        />
        <span>{t("solver.fewerDays")}</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          bind:checked={prefs.useFilter}
          class="rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
        />
        <span>{t("solver.useFilter")}</span>
      </label>
    </div>

    <button
      type="button"
      onclick={handleFind}
      class="self-start px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded text-sm font-medium transition-colors"
    >
      {t("solver.findAlternatives")}
    </button>

    {#if outcome}
      <div class="text-amber-700 dark:text-amber-400 font-medium">
        {#if outcome.reason === "unsatisfiable"}
          {t("list.solverUnsatisfiable")} {outcome.blockedOn}
        {:else}
          {t("list.solverGaveUp")} {outcome.blockedOn}
        {/if}
      </div>
    {/if}

    {#if alternatives && alternatives.length > 0}
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 p-3 bg-white dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={handlePrev}
            disabled={currentIndex === 0}
            class="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
            aria-label={t("solver.prev")}
          >
            &larr;
          </button>
          <span class="font-medium whitespace-nowrap" aria-live="polite">
            {t("solver.option", { index: currentIndex + 1, total: alternatives.length })}
          </span>
          <button
            type="button"
            onclick={handleNext}
            disabled={currentIndex === alternatives.length - 1}
            class="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
            aria-label={t("solver.next")}
          >
            &rarr;
          </button>
        </div>
        <button
          type="button"
          onclick={handleApply}
          class="ml-auto px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded font-medium transition-colors"
        >
          {t("solver.apply")}
        </button>
        <button
          type="button"
          onclick={closeSolverAlternatives}
          class="px-3 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
        >
          {t("solver.close")}
        </button>
      </div>
      <p class="text-xs text-zinc-600 dark:text-zinc-400" data-testid="solver-alt-note">
        {truncated ? t("solver.truncated") : t("solver.previewNote")}
      </p>
    {/if}
  </div>
</div>
