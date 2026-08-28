<script lang="ts">
  import {
    setSelectedDayHourFilter,
    setShowCoursesWithoutSchedule,
  } from "./globalState.svelte";
  import { t } from "./i18n.svelte";
  import IconFilter from "./icons/IconFilter.svelte";
  import IconX from "./icons/IconX.svelte";

  let dialog: HTMLDialogElement;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // keys for i18n
  const hours = Array.from({ length: 14 }, (_, i) => i + 9); // 9..22 inclusive

  let selectedDayHourFilter: boolean[][] = $state(initSelectedDayHourFilter());
  let showCoursesWithoutSchedule = $state(true);

  function initSelectedDayHourFilter(): boolean[][] {
    // selection state: rows = days, cols = hours
    return days.map(() => new Array(hours.length).fill(true));
  }

  function toggleSelectedDayHourFilter(dayIdx: number, hourIdx: number) {
    selectedDayHourFilter[dayIdx][hourIdx] =
      !selectedDayHourFilter[dayIdx][hourIdx];
  }

  function toggleDaySelectedDayHourFilter(dayIdx: number) {
    const allSelected = selectedDayHourFilter[dayIdx].every((val) => val);
    selectedDayHourFilter[dayIdx] = selectedDayHourFilter[dayIdx].map(
      () => !allSelected
    );
  }

  function toggleHourSelectedDayHourFilter(hourIdx: number) {
    const allSelected = selectedDayHourFilter.every((day) => day[hourIdx]);
    selectedDayHourFilter = selectedDayHourFilter.map((day) => {
      const newDay = [...day];
      newDay[hourIdx] = !allSelected;
      return newDay;
    });
  }

  function toggleAllSelectedDayHourFilter() {
    selectedDayHourFilter = selectedDayHourFilter.map((day) =>
      day.map(() => true)
    );
  }

  function toggleNoneSelectedDayHourFilter() {
    selectedDayHourFilter = selectedDayHourFilter.map((day) =>
      day.map(() => false)
    );
  }

  function saveFilters() {
    // Save to global state
    setShowCoursesWithoutSchedule($state.snapshot(showCoursesWithoutSchedule));
    setSelectedDayHourFilter($state.snapshot(selectedDayHourFilter));
    dialog.close();
  }
</script>

<div class="shrink-0">
  <button
    type="button"
    aria-label={t("filters.open")}
    onclick={() => dialog.showModal()}
    data-testid="filters-open"
    class="ml-2 flex h-full items-center rounded-md border border-zinc-300 bg-white px-2 text-zinc-600 transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-blue-400 dark:hover:text-blue-300 cursor-pointer"
  >
    <IconFilter />
  </button>
</div>

<!--
  Native <dialog> + showModal: the browser supplies the focus trap and Esc
  handling, so none of that is reimplemented here.
-->
<dialog
  bind:this={dialog}
  class="m-auto max-w-lg rounded-lg border border-zinc-200 bg-white p-4 text-zinc-900 shadow-xl backdrop:bg-black/60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
>
  <form method="dialog" class="mb-3 flex items-center">
    <h2 class="eyebrow">{t("filters.open")}</h2>
    <button
      class="ml-auto cursor-pointer text-zinc-600 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
      aria-label={t("palette.close")}><IconX /></button
    >
  </form>

  <div class="overflow-auto">
    <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem]">
      <label
        for="show-courses-without-schedule"
        class="flex cursor-pointer items-center gap-1.5 text-zinc-600 dark:text-zinc-300"
      >
        <input
          id="show-courses-without-schedule"
          type="checkbox"
          checked={showCoursesWithoutSchedule}
          onchange={() => {
            showCoursesWithoutSchedule = !showCoursesWithoutSchedule;
          }}
          class="h-4 w-4 cursor-pointer appearance-none rounded-[3px] border border-zinc-300 transition-colors checked:border-blue-500 checked:bg-blue-500 dark:border-zinc-600 dark:checked:border-blue-400 dark:checked:bg-blue-400"
        />
        {t("filters.showWithoutSchedule")}
      </label>

      <!--
        "Select all" / "unselect all" used to be checkboxes whose click was
        preventDefault-ed into a command — a control that looks like state but
        acts like a button. They are buttons.
      -->
      <span class="ml-auto flex gap-2">
        <button type="button" class="btn-quiet" onclick={toggleAllSelectedDayHourFilter}
          >{t("filters.selectAll")}</button
        >
        <button type="button" class="btn-quiet" onclick={toggleNoneSelectedDayHourFilter}
          >{t("filters.unselectAll")}</button
        >
      </span>
    </div>

    <!--
      The availability grid is the same domain object as the timetable — days
      across, hours down — so it speaks the same language: mono hour spine,
      eyebrow day headers, and a filled block meaning "this slot is shown".
    -->
    <table class="w-full table-fixed">
      <thead>
        <tr>
          <th class="w-12 p-1"></th>
          {#each days as day, dIdx}
            <th
              class="eyebrow cursor-pointer select-none p-1 text-center transition-colors hover:text-blue-600 dark:hover:text-blue-300"
              onclick={() => toggleDaySelectedDayHourFilter(dIdx)}>{t(`day.${day}`)}</th
            >
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each hours as h, hIdx}
          <tr class={hIdx === 0 ? "" : "row-rule"}>
            <td
              class="spine cursor-pointer select-none p-1 pr-2 transition-colors hover:text-blue-600 dark:hover:text-blue-300"
              onclick={() => toggleHourSelectedDayHourFilter(hIdx)}
              >{String(h).padStart(2, "0")}<span class="spine-min" aria-hidden="true">:00</span></td
            >
            {#each days as day, dIdx}
              <td class="p-0.5 text-center">
                <input
                  id={`chk-${dIdx}-${h}`}
                  type="checkbox"
                  aria-label={`${day} ${h}`}
                  checked={selectedDayHourFilter[dIdx][hIdx]}
                  onchange={() => toggleSelectedDayHourFilter(dIdx, hIdx)}
                  class="h-5 w-full cursor-pointer appearance-none rounded-[3px] border border-zinc-200 transition-colors checked:border-blue-500 checked:bg-blue-500/80 hover:border-blue-400 dark:border-zinc-700 dark:checked:border-blue-400 dark:checked:bg-blue-400/70"
                />
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>

    <div class="mt-3 flex justify-end">
      <button
        type="button"
        onclick={() => saveFilters()}
        data-testid="filters-apply"
        class="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
      >
        {t("filters.apply")}
      </button>
    </div>
  </div>
</dialog>
