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
  class="mt-4 shadow bg-white dark:bg-zinc-800 dark:text-white divide-y divide-gray-200 dark:divide-zinc-500 rounded-lg overflow-hidden shrink-0"
  onmouseleave={() => setHoveredCourse("")}
  role="region"
>
  <div class="py-2 px-4 bg-zinc-50 dark:bg-zinc-700 flex items-center">
    <span class="font-medium">{t("list.courses")}</span>
    <span
      class="ml-2 text-xs bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 border border-blue-600/50 dark:border-blue-400/50 rounded-full px-1"
      >{courseCount}</span
    >
    {#if getSelectedCourseNames().length > 0}
      <button
        type="button"
        class="ml-auto text-xs px-2 py-0.5 rounded border border-blue-600/50 dark:border-blue-400/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-pointer"
        onclick={copyShareLink}
        data-testid="copy-share-link"
      >
        {copiedLink ? t("list.copied") : t("list.copyLink")}
      </button>
    {/if}
    <button
      type="button"
      class="ml-2 text-xs px-2 py-0.5 rounded border border-blue-600/50 dark:border-blue-400/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-pointer"
      onclick={() => (showRoadmap = !showRoadmap)}
      data-testid="roadmap-toggle"
    >
      {t("roadmap.title")}
    </button>
  </div>
  {#if showRoadmap}
    <Roadmap />
  {:else}
  <div
    class="divide-y divide-gray-200 dark:divide-zinc-500"
    onmouseleave={() => setHoveredCourse("")}
    role="list"
  >
    {#if getCurSemesterData() && getSelectedCourseNames() && getSelectedCourseNames().length > 0}
      {#each getSelectedCourseNames() as courseName}
        <div
          class="py-1 px-2 flex items-center"
          onmouseenter={() => setHoveredCourse(courseName)}
          role="listitem"
        >
          <button
            type="button"
            class="cursor-pointer text-zinc-600 dark:text-zinc-400"
            onclick={() => {
              delCourse(courseName);
              resetHoveredCourse();
            }}
          >
            <IconX />
          </button><span class="ml-1">{courseName}</span>
          {#if "credits" in getCurSemesterData()[courseName]}
            <span
              class="ml-2 text-xs border rounded-full px-1 bg-green-50 text-green-700 border-green-700/50 dark:bg-green-900 dark:text-green-300 dark:border-green-300/50"
              >{getCurSemesterData()[courseName].credits} Cr</span
            >
          {/if}
        </div>
      {/each}
    {:else}
      <div
        class="text-zinc-500 text-sm h-8 flex flex-col justify-center items-center"
        data-testid="courses-empty"
      >
        {t("list.empty")}
      </div>
    {/if}
  </div>
  {/if}
  <div
    class="py-2 px-4 bg-zinc-50 dark:bg-zinc-700 text-green-700 dark:text-green-300 font-medium"
    data-testid="total-credits"
  >
    {t("list.totalCredits")} {totalCredit}
  </div>
  <div class="py-2 px-4 bg-zinc-50 dark:bg-zinc-700 flex items-center gap-2 flex-wrap">
    <button
      type="button"
      class="text-xs px-2 py-1 rounded border border-blue-600/50 dark:border-blue-400/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
        class="text-xs px-2 py-1 rounded border border-zinc-400/50 dark:border-zinc-500/50 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600 cursor-pointer"
        onclick={undoConflictFree}
        data-testid="solver-undo"
      >
        {t("list.undo")}
      </button>
    {/if}
  </div>
  <div class="py-2 px-4 bg-zinc-50 dark:bg-zinc-700">
    <CalendarExport />
  </div>
</div>

<div class="hidden md:block">
  <Footer />
</div>
