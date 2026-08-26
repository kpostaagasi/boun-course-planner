<script lang="ts">
  import {
    getSelectedCourseNames,
    getHoveredCourse,
    getCurSemesterData,
    getCurrentSemester,
  } from "./globalState.svelte";
  import { onMount } from "svelte";
  import { t, getLang } from "./i18n.svelte";

  type Holiday = { date: string; name?: string; timeType?: string; time?: string };
  type SemesterDates = { start?: string; end?: string; holidays?: Holiday[] };

  let semesterDates = $state<Record<string, SemesterDates> | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/semester-dates.json`);
      if (!res.ok) return;
      semesterDates = await res.json();
    } catch {
      // no date data available
    }
  });

  type CalendarInfo = {
    start: string;
    end: string;
    holidays: Holiday[];
  };

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(getLang() === "tr" ? "tr-TR" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const calendarInfo = $derived<CalendarInfo | null>(
    semesterDates && getCurrentSemester() && semesterDates[getCurrentSemester()]
      ? {
          start: semesterDates[getCurrentSemester()].start ?? "",
          end: semesterDates[getCurrentSemester()].end ?? "",
          holidays: semesterDates[getCurrentSemester()].holidays ?? [],
        }
      : null
  );

  const calculateTable = $derived(
    getCurrentSemester() != "" &&
      getCurSemesterData() !== undefined &&
      getCurSemesterData() !== null
  );

  const courseOnSaturday = $derived(
    getCourseOnSaturday(
      calculateTable,
      getSelectedCourseNames(),
      getCurSemesterData(),
      getHoveredCourse()
    )
  );

  const tableItems = $derived(
    getTableItems(
      calculateTable,
      getSelectedCourseNames(),
      getHoveredCourse(),
      getCurSemesterData()
    )
  );

  function getCourseOnSaturday(
    calculateTable: boolean,
    selectedCourseNames: string[],
    curSemesterData: any,
    hoveredCourse: string
  ) {
    if (!calculateTable) {
      return false;
    }

    for (let i = 0; i < selectedCourseNames.length; i++) {
      const courseName = selectedCourseNames[i];
      if (courseName in curSemesterData) {
        const days = curSemesterData[courseName].days;
        if (days) {
          for (let j = 0; j < days.length; j++) {
            if (days[j] == "St") {
              return true;
            }
          }
        }
      }
    }
    if (hoveredCourse != "") {
      const days = curSemesterData[hoveredCourse].days;
      if (days) {
        for (let j = 0; j < days.length; j++) {
          if (days[j] == "St") {
            return true;
          }
        }
      }
    }
    return false;
  }

  type HourData = {
    hour: number;
    M: string[];
    T: string[];
    W: string[];
    Th: string[];
    F: string[];
    St: string[];
  };

  type Days = "M" | "T" | "W" | "Th" | "F" | "St";

  function getTableItems(
    calculateTable: boolean,
    selectedCourseNames: string[],
    hoveredCourse: string,
    curSemesterData: any
  ) {
    let table: HourData[] = [];
    let latestCourseHour;
    for (let i = 9; i < 23; i++) {
      table.push({
        hour: i,
        M: [],
        T: [],
        W: [],
        Th: [],
        F: [],
        St: [],
      });
    }
    latestCourseHour = 16;
    if (calculateTable) {
      for (let i = 0; i < selectedCourseNames.length; i++) {
        const courseName = selectedCourseNames[i];
        if (!(courseName in curSemesterData)) {
          continue;
        }
        const { hours, days }: { hours: number[]; days: Days[] } =
          curSemesterData[courseName];
        if (days) {
          for (let j = 0; j < days.length; j++) {
            latestCourseHour = Math.max(latestCourseHour, hours[j] + 8);
            table[Number(hours[j]) - 1][days[j]].push(courseName);
          }
        }
      }
      if (hoveredCourse != "" && !selectedCourseNames.includes(hoveredCourse)) {
        const { hours, days }: { hours: number[]; days: Days[] } =
          curSemesterData[hoveredCourse];
        if (days) {
          for (let j = 0; j < days.length; j++) {
            latestCourseHour = Math.max(latestCourseHour, hours[j] + 8);
            table[Number(hours[j]) - 1][days[j]].push(hoveredCourse);
          }
        }
      }
    }

    for (let i = latestCourseHour + 1; i < 23; i++) {
      table.pop();
    }
    return table;
  }

  // Translucent tinted fill + same-hue bright text + saturated left accent:
  // reads crisply on dark rows instead of turning into muddy -900 slabs.
  // Full literal class strings so Tailwind's JIT scanner can see them.
  const PALETTE = [
    { bg: "bg-red-50 dark:bg-red-500/20", text: "text-red-800 dark:text-red-200", border: "border-red-400 dark:border-red-400/80" },
    { bg: "bg-orange-50 dark:bg-orange-500/20", text: "text-orange-800 dark:text-orange-200", border: "border-orange-400 dark:border-orange-400/80" },
    { bg: "bg-amber-50 dark:bg-amber-500/20", text: "text-amber-800 dark:text-amber-200", border: "border-amber-400 dark:border-amber-400/80" },
    { bg: "bg-yellow-50 dark:bg-yellow-500/20", text: "text-yellow-800 dark:text-yellow-200", border: "border-yellow-400 dark:border-yellow-400/80" },
    { bg: "bg-lime-50 dark:bg-lime-500/20", text: "text-lime-800 dark:text-lime-200", border: "border-lime-400 dark:border-lime-400/80" },
    { bg: "bg-emerald-50 dark:bg-emerald-500/20", text: "text-emerald-800 dark:text-emerald-200", border: "border-emerald-400 dark:border-emerald-400/80" },
    { bg: "bg-teal-50 dark:bg-teal-500/20", text: "text-teal-800 dark:text-teal-200", border: "border-teal-400 dark:border-teal-400/80" },
    { bg: "bg-sky-50 dark:bg-sky-500/20", text: "text-sky-800 dark:text-sky-200", border: "border-sky-400 dark:border-sky-400/80" },
    { bg: "bg-blue-50 dark:bg-blue-500/20", text: "text-blue-800 dark:text-blue-200", border: "border-blue-400 dark:border-blue-400/80" },
    { bg: "bg-indigo-50 dark:bg-indigo-500/20", text: "text-indigo-800 dark:text-indigo-200", border: "border-indigo-400 dark:border-indigo-400/80" },
    { bg: "bg-fuchsia-50 dark:bg-fuchsia-500/20", text: "text-fuchsia-800 dark:text-fuchsia-200", border: "border-fuchsia-400 dark:border-fuchsia-400/80" },
    { bg: "bg-pink-50 dark:bg-pink-500/20", text: "text-pink-800 dark:text-pink-200", border: "border-pink-400 dark:border-pink-400/80" },
  ];

  // FNV-1a: spreads course names across the 12 hues better than a 31-multi hash.
  function courseColor(name: string) {
    let hash = 2166136261;
    for (let i = 0; i < name.length; i++) {
      hash ^= name.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }

  const hoveredCourse = $derived(getHoveredCourse());
  const selectedCourses = $derived(getSelectedCourseNames());

  const DAYS: Days[] = ["M", "T", "W", "Th", "F", "St"];
  const DAY_LABELS: Record<Days, string> = {
    M: "Mon",
    T: "Tue",
    W: "Wed",
    Th: "Thu",
    F: "Fri",
    St: "Sat",
  };
</script>

{#if calendarInfo}
  <div class="flex flex-wrap gap-1 text-xs items-center mb-2 px-1">
    <span class="text-zinc-500 dark:text-zinc-400">
      {t("timetable.semesterStart")}: {formatDate(calendarInfo.start)}
    </span>
    <span class="text-zinc-500 dark:text-zinc-400">
      {t("timetable.semesterEnd")}: {formatDate(calendarInfo.end)}
    </span>
    {#each calendarInfo.holidays as h}
      <span class="bg-zinc-200 dark:bg-zinc-700 rounded px-1.5 py-0.5">
        {h.name} ({formatDate(h.date)})
      </span>
    {/each}
  </div>
{/if}
<div
  class="bg-white dark:bg-gray-800 dark:text-white shadow rounded-lg w-full shrink-0 overflow-x-auto"
>
  <table
    class="table-fixed text-center w-full text-sm lg:text-base antialiased tracking-tight sm:tracking-normal"
  >
    <thead>
      <tr>
        <th class="w-4 md:w-6"></th>
        {#each DAYS as day}
          <th class="w-20 {day == 'St' && !courseOnSaturday ? 'hidden' : ''}">
            {DAY_LABELS[day]}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
    {#each tableItems as row, i}
      <tr class={i % 2 == 0 ? "bg-gray-50 dark:bg-gray-700" : ""}>
        <th class="md:p-1"> {row["hour"]} </th>
        {#each DAYS as day}
          <td
            class="{day == 'St' && !courseOnSaturday ? 'hidden' : ''} {row[day].length > 1
              ? 'bg-red-100 dark:bg-red-900'
              : ''}"
            >{#each row[day] as course}{@const color = courseColor(course)}<div
                class="leading-tight px-1 py-px rounded-r border-l-2 {color.bg} {color.text} {color.border}
                  {course == hoveredCourse && !selectedCourses.includes(course)
                  ? 'opacity-75 ring-2 ring-zinc-400 dark:ring-zinc-200'
                  : course == hoveredCourse
                  ? 'ring-2 ring-zinc-400 dark:ring-zinc-200'
                  : ''}"
              >
                {course}
              </div>{/each}</td
          >
        {/each}
      </tr>
    {/each}
    </tbody>
  </table>
</div>
