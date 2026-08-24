<script lang="ts">
  import {
    getSelectedCourseNames,
    getHoveredCourse,
    getCurSemesterData,
    getCurrentSemester,
  } from "./globalState.svelte";

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

  // Full literal class strings so Tailwind's JIT scanner can see them.
  // Dynamic class construction (e.g. `bg-${x}-100`) would never be generated.
  const PALETTE = [
    { bg: "bg-blue-100", text: "text-blue-800", darkBg: "dark:bg-blue-900", darkText: "dark:text-blue-200" },
    { bg: "bg-emerald-100", text: "text-emerald-800", darkBg: "dark:bg-emerald-900", darkText: "dark:text-emerald-200" },
    { bg: "bg-amber-100", text: "text-amber-800", darkBg: "dark:bg-amber-900", darkText: "dark:text-amber-200" },
    { bg: "bg-violet-100", text: "text-violet-800", darkBg: "dark:bg-violet-900", darkText: "dark:text-violet-200" },
    { bg: "bg-rose-100", text: "text-rose-800", darkBg: "dark:bg-rose-900", darkText: "dark:text-rose-200" },
    { bg: "bg-cyan-100", text: "text-cyan-800", darkBg: "dark:bg-cyan-900", darkText: "dark:text-cyan-200" },
    { bg: "bg-lime-100", text: "text-lime-800", darkBg: "dark:bg-lime-900", darkText: "dark:text-lime-200" },
    { bg: "bg-orange-100", text: "text-orange-800", darkBg: "dark:bg-orange-900", darkText: "dark:text-orange-200" },
    { bg: "bg-fuchsia-100", text: "text-fuchsia-800", darkBg: "dark:bg-fuchsia-900", darkText: "dark:text-fuchsia-200" },
    { bg: "bg-sky-100", text: "text-sky-800", darkBg: "dark:bg-sky-900", darkText: "dark:text-sky-200" },
  ];

  function courseColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = hash * 31 + name.charCodeAt(i);
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
                class="leading-tight p-px rounded {color.bg} {color.text} {color.darkBg}
                  {color.darkText}
                  {course == hoveredCourse && !selectedCourses.includes(course)
                  ? 'ring-2 ring-green-500 opacity-75'
                  : course == hoveredCourse
                  ? 'ring-2 ring-green-500'
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
