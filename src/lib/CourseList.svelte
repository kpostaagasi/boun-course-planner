<script lang="ts">
  import {
    getSelectedCourseNames,
    getCurSemesterData,
    getCurrentSemester,
    setHoveredCourse,
    delCourse,
    resetHoveredCourse,
    setCourseList,
  } from "./globalState.svelte";
  import { groupKey, solveConflictFree } from "./solver";
  import { buildSelectionSearch } from "./urlState";
  import IconX from "./icons/IconX.svelte";
  import Footer from "./Footer.svelte";
  import CalendarExport from "./CalendarExport.svelte";
  import { t } from "./i18n.svelte";
  import Roadmap from "./Roadmap.svelte";

  const courseCount = $derived(
    getSelectedCourseNames().filter(
      (courseName: string) => !/(LAB|P.S.)/.test(courseName)
    ).length
  );

  const totalCredit = $derived.by(() => {
    if (!getCurSemesterData()) {
      return 0;
    }
    return getSelectedCourseNames()
      .filter((c) => !/(LAB|P.S.)/.test(c))
      .map((c) => {
        if (!getCurSemesterData()) {
          return 0;
        }
        if (!Object.prototype.hasOwnProperty.call(getCurSemesterData(), c)) {
          return 0;
        }
        if (
          !Object.prototype.hasOwnProperty.call(
            getCurSemesterData()[c],
            "credits"
          )
        ) {
          return 0;
        }
        return Number(getCurSemesterData()[c].credits);
      })
      .reduce((a, b) => a + b, 0);
  });

  let copiedLink = $state(false);
  let showRoadmap = $state(false);

  function copyShareLink() {
    // urlState.mjs owns the `?d=`/`?c=` wire format; hand-rolling it here is
    // how the share link and the history entry drift apart.
    const url = `${location.origin}${location.pathname}${buildSelectionSearch(
      location.search,
      getCurrentSemester(),
      getSelectedCourseNames()
    )}`;
    const markCopied = () => {
      copiedLink = true;
      setTimeout(() => {
        copiedLink = false;
      }, 2000);
    };
    navigator.clipboard
      .writeText(url)
      .then(markCopied)
      .catch(() => {
        window.prompt("Copy this link:", url);
        markCopied();
      });
  }
  /**
   * What the last solve found, recorded as facts rather than prose so the
   * message can be derived: flipping the language re-renders it instead of
   * leaving a stale English sentence on screen.
   */
  type SolverOutcome =
    | { kind: "applied" }
    | { kind: "unsatisfiable"; blockedOn: string; labsPinned: boolean }
    | { kind: "gave-up"; blockedOn: string };

  let prevSchedule = $state<string[] | null>(null);
  let solverOutcome = $state<SolverOutcome | null>(null);

  /**
   * Does the selection contain a section the solver structurally cannot swap?
   *
   * `groupKey` only strips a trailing `.NN`, so `"CMPE101.01 LAB 1"` is its own
   * group of one (see the note on `groupKey` in solver.mjs). The solver
   * therefore never reshuffles labs or problem sessions, even when free
   * alternatives exist, which means a fully explored search proves only "no
   * conflict-free combination exists *with these labs pinned*". That is worth
   * saying out loud, because the remedy belongs to the user: pick another lab.
   * Narrowed to keys that actually name a lab or problem session so the
   * wording is literally true.
   */
  function hasPinnedSubsections(selected: string[]): boolean {
    return selected.some(
      (key) => groupKey(key) === key && /(LAB|P\.S\.)/.test(key)
    );
  }

  // The dictionary entries are placeholder-free sentence openers, so the key
  // the solver reported is appended here rather than interpolated.
  const solverMessage = $derived.by(() => {
    const outcome = solverOutcome;
    if (!outcome) {
      return "";
    }
    if (outcome.kind === "applied") {
      return t("list.solverApplied");
    }
    if (outcome.kind === "unsatisfiable") {
      const proven = `${t("list.solverUnsatisfiable")} ${outcome.blockedOn}.`;
      return outcome.labsPinned
        ? `${proven} ${t("list.solverLabsFixed")}`
        : proven;
    }
    return `${t("list.solverGaveUp")} ${outcome.blockedOn}. ${t("list.solverGaveUpHint")}`;
  });

  function findConflictFree() {
    const current = getSelectedCourseNames();
    const result = solveConflictFree(current, getCurSemesterData());
    if (result.ok) {
      prevSchedule = [...current];
      setCourseList(result.schedule);
      solverOutcome = { kind: "applied" };
      return;
    }
    if (result.reason === "budget-exhausted") {
      // The search was cut off at SOLVER_TRIAL_BUDGET, so nothing was proven
      // and "no combination exists" would be false. `blockedOn` is only where
      // the search stalled, never a refuted requirement.
      solverOutcome = { kind: "gave-up", blockedOn: result.blockedOn };
      return;
    }
    // Search tree fully explored: the impossibility claim is earned.
    solverOutcome = {
      kind: "unsatisfiable",
      blockedOn: result.blockedOn,
      labsPinned: hasPinnedSubsections(current),
    };
  }

  function undoConflictFree() {
    if (!prevSchedule) {
      return;
    }
    setCourseList(prevSchedule);
    prevSchedule = null;
    solverOutcome = null;
  }
</script>

<div
  class="mt-4 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-200 dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
  onmouseleave={() => setHoveredCourse("")}
  role="region"
>
  <div class="flex items-baseline px-4 py-2.5">
    <span class="text-[0.9375rem] font-semibold">{t("list.courses")}</span>
    <!-- A count is data, not an alert: mono and quiet, not a coloured pill. -->
    <span class="u-data ml-2 text-[0.6875rem] text-zinc-600 dark:text-zinc-400"
      >{courseCount}</span
    >
    {#if getSelectedCourseNames().length > 0}
      <button
        type="button"
        class="btn-quiet ml-auto"
        onclick={copyShareLink}
        data-testid="copy-share-link"
      >
        {copiedLink ? t("list.copied") : t("list.copyLink")}
      </button>
    {/if}
    <button
      type="button"
      class="btn-quiet ml-2"
      onclick={() => (showRoadmap = !showRoadmap)}
      data-testid="roadmap-toggle"
    >
      {t("roadmap.title")}
    </button>
  </div>
  {#if showRoadmap}
    <Roadmap />
  {:else}
  <!-- The empty state lives OUTSIDE the role=list container: a list may only
       contain listitems (axe: aria-required-children, critical). -->
  {#if getCurSemesterData() && getSelectedCourseNames() && getSelectedCourseNames().length > 0}
    <div
      class="divide-y divide-zinc-100 dark:divide-zinc-700/60"
      onmouseleave={() => setHoveredCourse("")}
      role="list"
    >
      {#each getSelectedCourseNames() as courseName}
        <div
          class="group flex items-center px-4 py-1.5"
          onmouseenter={() => setHoveredCourse(courseName)}
          role="listitem"
        >
          <button
            type="button"
            aria-label="{t('course.removeSection')}: {courseName}"
            title={t("course.removeSection")}
            class="cursor-pointer text-zinc-600 transition-colors hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400"
            onclick={() => {
              delCourse(courseName);
              resetHoveredCourse();
            }}
          >
            <IconX />
          </button><span class="u-data ml-2 text-sm font-semibold">{courseName}</span>
          {#if "credits" in getCurSemesterData()[courseName]}
            <!-- Credits are data, not a status: no green pill. Green means seats. -->
            <span class="u-data ml-auto text-[0.6875rem] text-zinc-600 dark:text-zinc-400"
              >{getCurSemesterData()[courseName].credits}cr</span
            >
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div
      class="flex h-10 flex-col items-center justify-center text-sm text-zinc-600 dark:text-zinc-400"
      data-testid="courses-empty"
    >
      {t("list.empty")}
    </div>
  {/if}
  {/if}
  <div
    class="flex items-baseline px-4 py-2.5"
    data-testid="total-credits"
  >
    <span class="eyebrow">{t("list.totalCredits")}</span>
    <span class="u-data ml-2 text-[0.9375rem] font-semibold">{totalCredit}</span>
  </div>
  <div class="flex flex-wrap items-center gap-2 px-4 py-2.5">
    <button
      type="button"
      class="btn-quiet"
      disabled={getSelectedCourseNames().length < 2}
      onclick={findConflictFree}
      data-testid="find-conflict-free"
    >
      {t("list.findConflictFree")}
    </button>
    {#if solverOutcome}
      <span
        class="text-xs text-zinc-600 dark:text-zinc-300"
        data-testid="solver-message"
        data-solver-outcome={solverOutcome.kind}>{solverMessage}</span
      >
    {/if}
    {#if prevSchedule}
      <button
        type="button"
        class="btn-quiet"
        onclick={undoConflictFree}
        data-testid="solver-undo"
      >
        {t("list.undo")}
      </button>
    {/if}
  </div>
  <div class="px-4 py-2.5">
    <CalendarExport />
  </div>
</div>

<div class="hidden md:block">
  <Footer />
</div>
