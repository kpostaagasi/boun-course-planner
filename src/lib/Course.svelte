<script lang="ts">
  import IconPlus from "./icons/IconPlus.svelte";
  import IconMinus from "./icons/IconMinus.svelte";
  import IconDocument from "./icons/IconDocument.svelte";
  import {
    getSelectedCourseNames,
    getCurSemesterData,
    setHoveredCourse,
    delCourse,
    addCourse,
    getPrereqsFor,
    getDescriptionFor,
  } from "./globalState.svelte";

  let { course, courseName, striped, currentSemester, selected } = $props();
  const syllabusLink = $derived.by(() => {
    const [code, section] = course.code.split(".");
    const term = currentSemester.replace("-", "%2F");
    return `https://registration.boun.edu.tr/scripts/schedule/coursedescription.asp?course=${code}&section=${section}&term=${term}`;
  });

  const reportIssueUrl = $derived.by(() => {
    const bodyLines = [
      `Dönem: ${currentSemester}`,
      `Anahtar: ${courseName}`,
      ...("code" in course ? [`Kod: ${course.code}`] : []),
      ...("name" in course ? [`Ad: ${course.name}`] : []),
      `Hoca: ${course.instructor}`,
      ...("days" in course ? [`Günler: ${course.days.join(", ")}`] : []),
      ...("hours" in course ? [`Saatler: ${course.hours.join(", ")}`] : []),
      ...("rooms" in course ? [`Odalar: ${course.rooms.join(", ")}`] : []),
      ``,
      `Bu bilgiler yanlış/eksik çünkü: `,
      ``,
      `Kaynak sayfa: ${syllabusLink}`,
    ];
    return (
      `https://github.com/kpostaagasi/boun-course-planner/issues/new?title=` +
      encodeURIComponent(`Veri hatası: ${courseName} (${currentSemester})`) +
      `&body=` +
      encodeURIComponent(bodyLines.join("\n"))
    );
  });

  const prereqInfo = $derived(getPrereqsFor(course.code.split(".")[0].replace(/\s+/g, "")));

  const descriptionInfo = $derived(getDescriptionFor(course.code.split(".")[0].replace(/\s+/g, "")));
  let descriptionExpanded = $state(false);

  const conflicts = $derived.by(() => {
    const { hours, days } = getCurSemesterData()[courseName];
    let conflicts = [];
    for (let i = 0; i < getSelectedCourseNames().length; i++) {
      let conflictCount = 0;
      const otherCourse = getSelectedCourseNames()[i];
      if (otherCourse != courseName) {
        const { hours: hours2, days: days2 } =
          getCurSemesterData()[otherCourse];
        if (hours && hours2) {
          for (let j = 0; j < hours2.length; j++) {
            for (let k = 0; k < hours.length; k++) {
              if (hours2[j] == hours[k] && days2[j] == days[k]) {
                conflictCount++;
              }
            }
          }
        }
        if (conflictCount > 0) {
          conflicts.push({
            title: otherCourse,
            count: conflictCount,
          });
        }
      }
    }
    conflicts = conflicts;
    return conflicts;
  });
</script>

<div
  class="py-2 px-4 flex flex-row dark:text-white {striped
    ? 'bg-gray-50 dark:bg-gray-700'
    : 'bg-white dark:bg-zinc-800'}"
  onmouseenter={() => setHoveredCourse(courseName)}
  role="listitem"
>
  <div
    class="grow {conflicts.length > 0
      ? 'text-zinc-400 dark:text-zinc-500'
      : ''}"
  >
    <div class="flex items-center flex-wrap">
      <span class="text-lg font-medium mr-3">
        {courseName}
      </span>
      <span class="text-sm break-all">{course.name}</span>
      <span class="ml-auto mr-2">
        {#if conflicts.length > 0}
          <span class="text-red-500 text-xs font-medium p-1">Conflict</span>
        {/if}
        <span
          class="text-xs {conflicts.length > 0
            ? 'text-zinc-400 dark:text-zinc-500'
            : 'text-zinc-500 dark:text-zinc-400'}"
        >
          {#if "credits" in course}
            <span class="mr-2">{course.credits} Cr</span>
          {/if}
          {#if "ects" in course}
            <span>{course.ects} ECTS</span>
          {/if}
        </span>
      </span>
    </div>
    <div>
      <span class="mr-2">{course.instructor}</span>
      {#if "days" in course}
        <!-- <span class="mr-2">Days: {course.days.join("")}</span> -->
        <span class="mr-2">📅 {course.days.join("")}</span>
      {/if}
      {#if "hours" in course}
        <!-- <span class="mr-2">Hours: {course.hours.join("")}</span> -->
        <span class="mr-2">⏱️ {course.hours.join("")}</span>
      {/if}
      {#if "rooms" in course}
        <!-- <span class="">Rooms: {course.rooms.join(" ")}</span> -->
        <span class="">🏠 {course.rooms.join(" ")}</span>
      {/if}
    </div>
    {#if "requiredForDept" in course}
      <div
        class="text-sm {conflicts.length > 0
          ? 'text-zinc-400 dark:text-zinc-500'
          : 'text-zinc-500'}"
      >
        Required for department: {course.requiredForDept.join(", ")}
      </div>
    {/if}
    {#if "dept" in course}
      <div
        class="text-sm {conflicts.length > 0
          ? 'text-zinc-400 dark:text-zinc-500'
          : 'text-zinc-500'}"
      >
        Departments: {course.dept.join(", ")}
      </div>
    {/if}
    {#if prereqInfo && (prereqInfo.prereqs.length > 0 || prereqInfo.consent || prereqInfo.gpa)}
      {#if prereqInfo.prereqs.length > 0}
        <div
          class="text-sm {conflicts.length > 0
            ? 'text-zinc-400 dark:text-zinc-500'
            : 'text-zinc-500 dark:text-zinc-400'}"
        >
          Prerequisite: {prereqInfo.prereqs.join(", ")}
        </div>
      {/if}
      {#if prereqInfo.consent}
        <div
          class="text-sm {conflicts.length > 0
            ? 'text-zinc-400 dark:text-zinc-500'
            : 'text-zinc-500 dark:text-zinc-400'}"
        >
          Instructor consent required
        </div>
      {/if}
      {#if prereqInfo.gpa}
        <div
          class="text-sm {conflicts.length > 0
            ? 'text-zinc-400 dark:text-zinc-500'
            : 'text-zinc-500 dark:text-zinc-400'}"
        >
          Min. GPA: {prereqInfo.gpa}
        </div>
      {/if}
    {/if}
    {#if descriptionInfo?.description}
      {#if descriptionExpanded}
        <div
          class="mt-1 text-sm whitespace-pre-line {conflicts.length > 0
            ? 'text-zinc-400 dark:text-zinc-500'
            : 'text-zinc-500 dark:text-zinc-400'}"
        >
          {descriptionInfo.description}
          {#if descriptionInfo.prerequisite}
            <div class="mt-1">Catalog prerequisite: {descriptionInfo.prerequisite}</div>
          {/if}
        </div>
      {/if}
      <button
        type="button"
        class="text-xs cursor-pointer {conflicts.length > 0
          ? 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
          : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}"
        onclick={() => (descriptionExpanded = !descriptionExpanded)}
      >
        {descriptionExpanded ? "Hide description ▲" : "Show description ▼"}
      </button>
    {/if}
  </div>
  <div class="flex flex-col items-end shrink-0">
    <div class="flex flex-col-reverse sm:flex-row">
      <a
        href={reportIssueUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Report incorrect data"
        class="self-center mr-0 mt-2 sm:mr-2 sm:mt-0 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-500 text-xs"
      >
        ⚠
      </a>
      <a
        href={syllabusLink}
        target="_blank"
        rel="noopener noreferrer"
        class="block mr-0 mt-2 sm:mr-2 sm:mt-0 bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-800 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-400 dark:hover:text-blue-200 p-2 text-center"
      >
        <IconDocument />
      </a>
      {#if selected}
        <button
          type="button"
          class="bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-400 dark:hover:text-red-200 p-2 text-center cursor-pointer"
          onclick={() => delCourse(courseName)}
        >
          <IconMinus />
        </button>
      {:else}
        <button
          type="button"
          class="bg-green-100 hover:bg-green-200 text-green-600 hover:text-green-800 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-400 dark:hover:text-green-200 p-2 text-center cursor-pointer"
          onclick={() => addCourse(courseName)}
        >
          <IconPlus />
        </button>
      {/if}
    </div>
  </div>
</div>
