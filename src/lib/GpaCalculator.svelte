<script lang="ts">
  import {
    getCurSemesterData,
    getSelectedCourseNames,
    getGpaEntriesForCurrentSemester,
    getGpaBaseline,
    setGpaBaseline,
    setGpaGrade,
    setGpaRetakeOf,
    clearGpaEntries,
    setActiveTab,
  } from "./globalState.svelte";
  import {
    GRADES,
    RETAKEABLE_GRADES,
    computeTermStats,
    computeCumulativeStats,
    type GpaCourse,
    type Retake,
  } from "./gpa";
  import { t } from "./i18n.svelte";
  import Footer from "./Footer.svelte";
  import IconSelector from "./icons/IconSelector.svelte";

  /**
   * One line of the panel: a planned section plus whatever the student has
   * said about it. `credits: undefined` is not zero — the registrar publishes
   * no credit figure for some rows, and such a course is shown but explicitly
   * left out of the average rather than counted as a free 0.
   */
  type Row = {
    key: string;
    name: string;
    credits: number | undefined;
    grade: string;
    retakeOf: string;
  };

  // The plan IS the input. Same LAB/P.S. rule as CourseList so the two panels
  // agree on what counts as a course: sub-rows carry no credits of their own,
  // their lecture section does.
  const rows = $derived.by<Row[]>(() => {
    const data = getCurSemesterData();
    if (!data) return [];
    const entries = getGpaEntriesForCurrentSemester();
    return getSelectedCourseNames()
      .filter((key) => !/(LAB|P\.S\.)/.test(key))
      .map((key) => {
        const info = data[key];
        const entry = entries[key];
        return {
          key,
          name: typeof info?.name === "string" ? info.name : "",
          credits: typeof info?.credits === "number" ? info.credits : undefined,
          grade: entry?.grade ?? "",
          retakeOf: entry?.retakeOf ?? "",
        };
      });
  });

  const courses = $derived<GpaCourse[]>(
    rows.map((row) => ({ credits: row.credits, grade: row.grade })),
  );

  /**
   * Only a repeat that has a NEW grade withdraws the old attempt. Withdrawing
   * it as soon as the old grade is named would take credits out of the
   * cumulative record and put nothing back, which reads as a GPA change the
   * student never made.
   */
  const retakes = $derived<Retake[]>(
    rows
      .filter((row) => row.grade && row.retakeOf)
      .map((row) => ({ credits: row.credits, oldGrade: row.retakeOf })),
  );

  const termStats = $derived(computeTermStats(courses));

  /**
   * The typed record, judged before it is used. An out-of-range figure is
   * neither silently clamped nor treated as zero: the field says what is wrong
   * and the cumulative line stays blank, because a number derived from a value
   * we rejected would be fiction.
   */
  const baseline = $derived.by(() => {
    const gpaRaw = getGpaBaseline().gpa.trim();
    const creditsRaw = getGpaBaseline().credits.trim();
    if (!gpaRaw && !creditsRaw) return { state: "empty" as const };
    const gpa = Number(gpaRaw);
    const credits = Number(creditsRaw);
    const gpaOk = gpaRaw !== "" && Number.isFinite(gpa) && gpa >= 0 && gpa <= 4;
    const creditsOk =
      creditsRaw !== "" && Number.isFinite(credits) && credits >= 0;
    if (!gpaOk || !creditsOk) {
      return { state: "invalid" as const, gpaOk, creditsOk };
    }
    return { state: "ok" as const, gpa, credits, gpaOk, creditsOk };
  });

  const cumulative = $derived(
    baseline.state === "ok"
      ? computeCumulativeStats(
          courses,
          { gpa: baseline.gpa, credits: baseline.credits },
          retakes,
        )
      : null,
  );

  const gradedCount = $derived(rows.filter((row) => row.grade).length);

  /** A GPA, or the em dash that means "we were not told". */
  function fmtGpa(value: number | null): string {
    return value === null ? "—" : value.toFixed(2);
  }
</script>

{#snippet picker(
  label: string,
  testid: string,
  course: string,
  value: string,
  width: string,
  choices: { value: string; text: string }[],
  disabled: boolean,
  onchange: (next: string) => void,
  /** Mono is semantic in this app: it marks registrar data, not prose. */
  mono = true,
)}
  <!--
    Same chevron-over-an-appearance-none-select construction as
    SemesterSelect: a bare `appearance-none` control reads as a text field, and
    a native arrow here would be the only one in the app.
  -->
  <div class="relative shrink-0 {width}">
    <select
      aria-label={label}
      data-testid={testid}
      data-course={course}
      {disabled}
      class="{mono
        ? 'u-data text-zinc-900 dark:text-zinc-100'
        : 'text-zinc-600 dark:text-zinc-300'} w-full cursor-pointer appearance-none rounded-lg border border-zinc-200 bg-white py-1.5 pr-7 pl-2.5 text-xs font-medium transition-colors hover:border-zinc-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:focus:ring-blue-400"
      {value}
      oninput={(e) => onchange((e.currentTarget as HTMLSelectElement).value)}
    >
      {#each choices as choice (choice.value)}
        <option value={choice.value}>{choice.text}</option>
      {/each}
    </select>
    <div
      class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5 text-zinc-400"
    >
      <IconSelector />
    </div>
  </div>
{/snippet}

<!--
  The GPA view of the same plan. It adds one input — the grade you expect —
  and answers the only two questions that follow from it: what this term
  averages, and what that does to the record you already have.

  Everything here is a projection from what the student typed. Nothing is
  fetched, nothing is official, and the panel says so at the bottom rather than
  letting a two-decimal figure imply a transcript.
-->
<div class="mx-auto flex w-full max-w-3xl flex-col gap-3 md:gap-4">
  <div class="card divide-y divide-zinc-100 dark:divide-zinc-700/60 dark:text-white">
    <div class="flex items-center gap-2 px-4 py-3">
      <h2 class="text-[0.9375rem] font-semibold">{t("gpa.termCourses")}</h2>
      <span class="u-data text-xs text-zinc-500 dark:text-zinc-400">{rows.length}</span>
      {#if gradedCount > 0}
        <button
          type="button"
          class="btn-quiet ml-auto"
          onclick={clearGpaEntries}
          data-testid="gpa-clear">{t("gpa.clear")}</button
        >
      {/if}
    </div>

    {#if rows.length > 0}
      <div class="divide-y divide-zinc-100 dark:divide-zinc-700/60" role="list">
        {#each rows as row (row.key)}
          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5"
            role="listitem"
          >
            <div class="flex min-w-0 grow basis-40 flex-col">
              <span class="u-data text-sm font-medium">{row.key}</span>
              {#if row.name}
                <span class="truncate text-xs text-zinc-500 dark:text-zinc-400"
                  >{row.name}</span
                >
              {/if}
            </div>

            {#if row.credits === undefined}
              <span
                class="basis-full text-xs text-zinc-500 sm:basis-auto dark:text-zinc-400"
                >{t("gpa.creditsUnknown")}</span
              >
            {:else}
              <!-- w-16 + nowrap, not w-12: the unit is a word in Turkish
                   ("3 kredi"), and at w-12 every row wrapped to two lines. -->
              <span
                class="u-data w-16 shrink-0 text-right text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400"
                data-testid="gpa-row-credits"
                data-course={row.key}>{row.credits} {t("gpa.credits")}</span
              >
            {/if}

            <!--
              w-28, not w-20: a native select clips rather than ellipsising, and
              at w-20 the 40px text box cut the empty option — the state every
              row starts in — to "Not gr" in English and "Not gi" in Turkish.
              Mono is switched off while that option is showing, because it is
              prose; a chosen grade is registrar data and stays mono.
            -->
            {@render picker(
              t("gpa.gradeFor", { course: row.key }),
              "gpa-grade",
              row.key,
              row.grade,
              "w-28",
              [
                { value: "", text: t("gpa.noGradeOption") },
                ...GRADES.map((grade) => ({ value: grade, text: grade })),
              ],
              row.credits === undefined,
              (next) => setGpaGrade(row.key, next),
              row.grade !== "",
            )}

            <!--
              One control, not a checkbox plus a select: naming the grade being
              repeated already says that this is a repeat, and one slot of
              constant width is what keeps the columns aligned down the list.
            -->
            {@render picker(
              t("gpa.previousGradeFor", { course: row.key }),
              "gpa-retake",
              row.key,
              row.retakeOf,
              "w-32",
              [
                { value: "", text: t("gpa.notRetake") },
                ...RETAKEABLE_GRADES.map((grade) => ({
                  value: grade,
                  text: t("gpa.retakeOf", { grade }),
                })),
              ],
              row.credits === undefined,
              (next) => setGpaRetakeOf(row.key, next),
              false,
            )}
          </div>
        {/each}
      </div>
      <!--
        Shown as soon as a repeat is NAMED, not once it counts: the withdrawal
        waits for the new grade, and a student who set the old one and saw
        nothing move deserves to know why.
      -->
      {#if rows.some((row) => row.retakeOf)}
        <p class="px-4 py-2.5 text-xs text-zinc-600 dark:text-zinc-400">
          {t("gpa.retakeHint")}
        </p>
      {/if}
    {:else}
      <div class="px-4 py-8 text-center" data-testid="gpa-empty">
        <p class="text-sm text-zinc-500 dark:text-zinc-400">{t("gpa.empty")}</p>
        <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("gpa.emptyHint")}</p>
        <button
          type="button"
          class="btn-quiet mt-3"
          onclick={() => setActiveTab("planner")}>{t("gpa.goToPlanner")}</button
        >
      </div>
    {/if}
  </div>

  <div class="card divide-y divide-zinc-100 dark:divide-zinc-700/60 dark:text-white">
    <div class="px-4 py-3">
      <h2 class="text-[0.9375rem] font-semibold">{t("gpa.record")}</h2>
      <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("gpa.recordHint")}</p>
    </div>
    <div class="grid gap-3 px-4 py-3 sm:grid-cols-2">
      <div class="flex flex-col gap-1.5">
        <label class="eyebrow" for="gpa-previous">{t("gpa.previousGpa")}</label>
        <input
          id="gpa-previous"
          type="number"
          inputmode="decimal"
          step="0.01"
          min="0"
          max="4"
          placeholder="3.00"
          data-testid="gpa-previous"
          aria-invalid={baseline.state === "invalid" && !baseline.gpaOk}
          aria-describedby={baseline.state === "invalid" && !baseline.gpaOk
            ? "gpa-previous-error"
            : undefined}
          class="u-data w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-blue-400"
          value={getGpaBaseline().gpa}
          oninput={(e) =>
            setGpaBaseline({ gpa: (e.currentTarget as HTMLInputElement).value })}
        />
        {#if baseline.state === "invalid" && !baseline.gpaOk}
          <span id="gpa-previous-error" class="text-xs text-red-600 dark:text-red-300"
            >{t("gpa.gpaRange")}</span
          >
        {/if}
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="eyebrow" for="gpa-previous-credits"
          >{t("gpa.previousCredits")}</label
        >
        <input
          id="gpa-previous-credits"
          type="number"
          inputmode="numeric"
          step="1"
          min="0"
          placeholder="60"
          data-testid="gpa-previous-credits"
          aria-invalid={baseline.state === "invalid" && !baseline.creditsOk}
          aria-describedby={baseline.state === "invalid" && !baseline.creditsOk
            ? "gpa-previous-credits-error"
            : undefined}
          class="u-data w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-blue-400"
          value={getGpaBaseline().credits}
          oninput={(e) =>
            setGpaBaseline({
              credits: (e.currentTarget as HTMLInputElement).value,
            })}
        />
        {#if baseline.state === "invalid" && !baseline.creditsOk}
          <span
            id="gpa-previous-credits-error"
            class="text-xs text-red-600 dark:text-red-300">{t("gpa.creditsRange")}</span
          >
        {/if}
      </div>
    </div>
  </div>

  <div class="card divide-y divide-zinc-100 dark:divide-zinc-700/60 dark:text-white">
    <div class="px-4 py-3">
      <h2 class="text-[0.9375rem] font-semibold">{t("gpa.result")}</h2>
    </div>
    <div class="flex items-baseline gap-3 px-4 py-3">
      <span class="eyebrow">{t("gpa.termGpa")}</span>
      <span
        class="u-data ml-auto text-lg font-semibold"
        data-testid="gpa-term">{fmtGpa(termStats.gpa)}</span
      >
    </div>
    <div class="flex items-baseline gap-3 px-4 py-3">
      <span class="eyebrow">{t("gpa.cumulativeGpa")}</span>
      <span
        class="u-data ml-auto text-lg font-semibold"
        data-testid="gpa-cumulative">{fmtGpa(cumulative?.gpa ?? null)}</span
      >
    </div>
    <div class="flex items-baseline gap-3 px-4 py-3">
      <span class="eyebrow">{t("gpa.gradedCredits")}</span>
      <span class="u-data ml-auto text-sm font-semibold" data-testid="gpa-credits"
        >{termStats.gpaCredits}</span
      >
    </div>
    {#if termStats.gpa === null}
      <p class="px-4 py-2.5 text-xs text-zinc-600 dark:text-zinc-400">
        {t("gpa.noGrades")}
      </p>
    {:else if baseline.state !== "ok"}
      <p class="px-4 py-2.5 text-xs text-zinc-600 dark:text-zinc-400">
        {t("gpa.needsRecord")}
      </p>
    {/if}
  </div>

  <p class="px-1 text-xs text-zinc-500 dark:text-zinc-400">{t("gpa.disclaimer")}</p>

  <!-- The "no affiliation" line and the freshness stamp belong on every
       surface, not only on the planner tab. -->
  <Footer />
</div>
