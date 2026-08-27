<script lang="ts">
  import IconMinus from "./icons/IconMinus.svelte";
  import PrereqTree from "./PrereqTree.svelte";
  import IconDocument from "./icons/IconDocument.svelte";
  import IconPlus from "./icons/IconPlus.svelte";
  import {
    getSelectedCourseNames,
    getCurSemesterData,
    setHoveredCourse,
    setSearchQuery,
    delCourse,
    addCourse,
    getPrereqsFor,
    getPrereqsAll,
    getDescriptionFor,
    getCompletedCourseSet,
    getOfferings,
    getQuotaFor,
    getQuotaScrapedAt,
    isCompleted,
    loadQuota,
    toggleCompleted,
  } from "./globalState.svelte";
  import { t, getLang } from "./i18n.svelte";
  import { getEligibility } from "./eligibility";
  import { baseCode, isPlaceholderInstructor } from "./courseKey";
  import { conflicts as slotsOverlap } from "./solver";
  import { quotaAge, quotaDisplay } from "./quotaInfo";
  import { examConflictFor, type ExamSection } from "./examConflict";
  import { termHistory } from "./termHistory";

  let { course, courseName, striped, currentSemester, selected } = $props();

  // Quota is list-level data — every catalogue row wants it — and `loadQuota`
  // dedupes to a single request, so starting it from card init costs one fetch
  // and keeps it off the first-paint critical path. See `loadQuota` for the
  // payload-budget measurements behind that choice.
  loadQuota();

  /** Course identity, e.g. `"AD251.01 P.S. 1"` -> `"AD251"`. Derived once. */
  const base = $derived(baseCode(course.code));

  const syllabusLink = $derived.by(() => {
    const [code, section] = course.code.split(".");
    const term = currentSemester.replace("-", "%2F");
    return `https://registration.boun.edu.tr/scripts/schedule/coursedescription.asp?course=${code}&section=${section}&term=${term}`;
  });

  // The prefilled issue body used to be hardcoded Turkish no matter the UI
  // language, so an English-speaking reporter got a Turkish template.
  const reportIssueUrl = $derived.by(() => {
    const bodyLines = [
      `${t("report.term")}: ${currentSemester}`,
      `${t("report.key")}: ${courseName}`,
      ...("code" in course ? [`${t("report.code")}: ${course.code}`] : []),
      ...("name" in course ? [`${t("report.name")}: ${course.name}`] : []),
      `${t("report.instructor")}: ${course.instructor}`,
      ...("days" in course
        ? [`${t("report.days")}: ${course.days.join(", ")}`]
        : []),
      ...("hours" in course
        ? [`${t("report.hours")}: ${course.hours.join(", ")}`]
        : []),
      ...("rooms" in course
        ? [`${t("report.rooms")}: ${course.rooms.join(", ")}`]
        : []),
      ``,
      `${t("report.reason")} `,
      ``,
      `${t("report.source")}: ${syllabusLink}`,
    ];
    return (
      `https://github.com/kpostaagasi/boun-course-planner/issues/new?title=` +
      encodeURIComponent(
        `${t("report.title")}: ${courseName} (${currentSemester})`,
      ) +
      `&body=` +
      encodeURIComponent(bodyLines.join("\n"))
    );
  });

  const completedSet = $derived(getCompletedCourseSet());
  const prereqMap = $derived(getPrereqsAll());
  const eligibility = $derived(getEligibility(base, completedSet, prereqMap));
  const prereqInfo = $derived(getPrereqsFor(base));
  const descriptionInfo = $derived(getDescriptionFor(base));

  const offeringsMap = $derived(getOfferings());
  const offeredTerms = $derived(offeringsMap ? offeringsMap[base] ?? null : null);
  const offeringHistory = $derived(offeredTerms ? termHistory(offeredTerms) : null);
  const seasonGlyphs = $derived.by(() => {
    if (!offeringHistory) return "";
    const names: Record<number, string> = {
      1: "Fall",
      2: "Spring",
      3: "Summer",
    };
    return offeringHistory.seasons
      .map((s) => (getLang() === "tr" ? { 1: "Güz", 2: "Bahar", 3: "Yaz" }[s] : names[s]))
      .join("/");
  });

  let descriptionExpanded = $state(false);
  let treeExpanded = $state(false);

  /** Selected sections this one shares a day+hour slot with. */
  const conflicts = $derived.by(() => {
    const data = getCurSemesterData();
    const self = data[courseName];
    if (!self) return [];
    const clashing: string[] = [];
    for (const other of getSelectedCourseNames()) {
      if (other === courseName) continue;
      const section = data[other];
      if (section && slotsOverlap(self, section)) clashing.push(other);
    }
    return clashing;
  });

  // ---- Live quota / enrolment -------------------------------------------
  //
  // `quotaScrapedAt` is non-null only when quota.json is loaded AND was scraped
  // for the term on screen AND carries a timestamp. It therefore doubles as the
  // render gate: with no dated dataset there is nothing to say about seats, and
  // an "unknown" row on all 3140 cards would be noise rather than honesty.
  const quotaScrapedAt = $derived(getQuotaScrapedAt());
  const quota = $derived(quotaDisplay(getQuotaFor(courseName)));
  // Only used for emphasis, at day granularity, so it does not need to tick.
  const quotaStale = $derived((quotaAge(quotaScrapedAt)?.minutes ?? 0) >= 24 * 60);
  /**
   * The scrape time, shown verbatim rather than as "N minutes ago": a relative
   * age computed once at render would silently freeze in a long-lived tab, and
   * an enrolment count that looks fresher than it is defeats the point.
   */
  const quotaClock = $derived.by(() => {
    if (!quotaScrapedAt) return "";
    const at = new Date(quotaScrapedAt);
    if (Number.isNaN(at.getTime())) return "";
    return at.toLocaleString(getLang() === "tr" ? "tr-TR" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  });

  // ---- Final-exam clash -------------------------------------------------
  //
  // `examConflictFor` returns "clash", "maybe", "clear" or "unknown"; only the
  // first two are worth rendering as a warning, and "clear" is a claim it makes
  // exclusively when every pair was actually decidable.
  const examStatus = $derived.by(() => {
    const data = getCurSemesterData();
    const sections: ExamSection[] = [
      { key: courseName, examDate: course.examDate, examSlot: course.examSlot },
    ];
    for (const other of getSelectedCourseNames()) {
      if (other === courseName) continue;
      const section = data[other];
      if (section) {
        sections.push({
          key: other,
          examDate: section.examDate,
          examSlot: section.examSlot,
        });
      }
    }
    return examConflictFor(courseName, sections);
  });

  /** 82 sections of the current term are staffed by "STAFF STAFF": no one to search for. */
  const instructorSearchable = $derived(!isPlaceholderInstructor(course.instructor));
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
          <span class="text-red-500 text-xs font-medium p-1">{t("course.conflict")}</span>
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
          {#if offeringHistory}
            <span
              class="text-xs text-zinc-400 dark:text-zinc-500 mr-2"
              title={t("course.offeredTerms").replace("{n}", String(offeringHistory.count))}
            >
              {offeringHistory.count}× · {seasonGlyphs}
            </span>
          {/if}
        </span>
      </span>
      {#if eligibility.status === "taken"}
        <span class="text-xs font-medium text-green-600 dark:text-green-400 mr-2">✓ {t("course.taken")}</span>
      {:else if eligibility.status === "eligible"}
        <span
          class="text-xs text-emerald-600 dark:text-emerald-400 mr-2"
          title={t("course.eligibleTitle")}
        >
          {t("course.eligible")}
        </span>
      {:else if eligibility.status === "missing-prereq"}
        <span class="text-xs text-amber-600 dark:text-amber-400 mr-2" title={eligibility.missing.join(", ")}>
          {t("course.needs")} {eligibility.missing.join(", ")}{eligibility.moreMissing ? "…" : ""}
        </span>
      {:else if prereqMap}
        <!--
          The remaining status is "no-data", and the map being loaded narrows
          that to one meaning: this course was never part of the prerequisite
          crawl (314 of the current term's 1324 courses). Rendering nothing here
          made an unverified course look identical to a checked one, which is how
          a card could imply eligibility it had never established.
        -->
        <span
          class="text-xs italic text-zinc-400 dark:text-zinc-500 mr-2"
          data-testid="course-prereq-unknown"
          title={t("course.prereqUnknownTitle")}
        >
          ? {t("course.prereqUnknown")}
        </span>
      {/if}
    </div>
    <div>
      {#if instructorSearchable}
        <button
          type="button"
          class="mr-2 text-left cursor-pointer hover:underline"
          data-testid="course-instructor"
          title={t("course.searchInstructor")}
          onclick={() => setSearchQuery(course.instructor)}
        >
          {course.instructor}
        </button>
      {:else}
        <!-- "STAFF STAFF": searching for it returns 82 unrelated sections. -->
        <span class="mr-2">{course.instructor}</span>
      {/if}
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
    {#if quotaScrapedAt}
      <!--
        Rendered only when quota.json is loaded, dated, and scraped for the term
        on screen — otherwise there is nothing to report and an "unknown" row on
        every card would be noise. Within that gate, a section we hold no record
        for still gets a row, because "we do not know" is information and a blank
        space is not.
      -->
      <div
        class="text-sm flex flex-wrap items-baseline gap-x-2 {conflicts.length > 0
          ? 'text-zinc-400 dark:text-zinc-500'
          : 'text-zinc-500 dark:text-zinc-400'}"
        data-testid="course-quota"
      >
        {#if quota.kind === "enrolment" && quota.quota !== null && quota.current !== null}
          <span data-testid="course-quota-state">
            {t("quota.seats", { current: quota.current, quota: quota.quota })}
          </span>
          {#if quota.overEnrolled}
            <span class="font-medium text-red-600 dark:text-red-400">
              {t("quota.over", { n: quota.current - quota.quota })}
            </span>
          {:else if quota.full}
            <span class="font-medium text-red-600 dark:text-red-400">{t("quota.full")}</span>
          {:else}
            <span class="text-emerald-600 dark:text-emerald-400">
              {t("quota.left", { n: quota.quota - quota.current })}
            </span>
          {/if}
          {#if quota.cap !== null}
            <span class="text-xs">{t("quota.capacity", { cap: quota.cap })}</span>
          {/if}
        {:else if quota.kind === "note-only"}
          <!-- No numeric allocation: the verbatim cell IS the registration rule. -->
          <span data-testid="course-quota-state">{quota.notes.join(" · ")}</span>
          {#if quota.cap !== null}
            <span class="text-xs">{t("quota.capacity", { cap: quota.cap })}</span>
          {/if}
        {:else if quota.kind === "capacity-only" && quota.cap !== null}
          <span data-testid="course-quota-state">
            {t("quota.capacity", { cap: quota.cap })}
          </span>
          <span class="text-xs italic">{t("quota.enrolmentUnpublished")}</span>
        {:else}
          <span class="italic" data-testid="course-quota-state">{t("quota.noData")}</span>
        {/if}
        {#if quota.restricted}
          <span class="text-xs">{t("quota.restricted", { depts: quota.depts.join(", ") })}</span>
        {/if}
        {#if quota.surnameRestricted}
          <span class="text-xs">{t("quota.surname")}</span>
        {/if}
        <span
          class="text-xs {quotaStale
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-zinc-400 dark:text-zinc-500'}"
          title={t("quota.scrapedTitle", { time: quotaClock })}
        >
          {t("quota.asOf", { time: quotaClock })}
        </span>
      </div>
    {/if}
    {#if "deliveryMethod" in course || "examDate" in course || "examSlot" in course || "finalExamLocation" in course}
      <!--
        The registrar leaves all four cells blank until the exam schedule is
        published, so these are strictly conditional: no empty rows out of season.
      -->
      <div
        class="text-sm {conflicts.length > 0
          ? 'text-zinc-400 dark:text-zinc-500'
          : 'text-zinc-500 dark:text-zinc-400'}"
        data-testid="course-exam"
      >
        {#if "deliveryMethod" in course}
          <span class="mr-2">{t("course.delivery")} {course.deliveryMethod}</span>
        {/if}
        {#if "examDate" in course}
          <span class="mr-2">{t("course.finalExam")} {course.examDate}</span>
        {/if}
        {#if "examSlot" in course}
          <span class="mr-2">· {t("course.examSession")} {course.examSlot}</span>
        {/if}
        {#if "finalExamLocation" in course}
          <span class="mr-2">{t("course.examLocation")} {course.finalExamLocation}</span>
        {/if}
      </div>
    {/if}
    {#if examStatus.status === "clash"}
      <div
        class="text-sm font-medium text-red-600 dark:text-red-400"
        data-testid="course-exam-clash"
      >
        {t("course.examClash", { keys: examStatus.with.join(", ") })}
      </div>
    {:else if examStatus.status === "maybe"}
      <div class="text-sm text-amber-600 dark:text-amber-400" data-testid="course-exam-clash">
        {t("course.examMaybeClash", { keys: examStatus.with.join(", ") })}
      </div>
    {:else if examStatus.status === "clear" && examStatus.compared > 0}
      <!-- The only status that licenses a positive claim: every pair was decidable. -->
      <div class="text-xs text-zinc-400 dark:text-zinc-500" data-testid="course-exam-clear">
        {t("course.examNoClash")}
      </div>
    {/if}
    {#if "requiredForDept" in course}
      <div
        class="text-sm {conflicts.length > 0
          ? 'text-zinc-400 dark:text-zinc-500'
          : 'text-zinc-500'}"
      >
        {t("course.requiredFor")} {course.requiredForDept.join(", ")}
      </div>
    {/if}
    {#if "dept" in course}
      <div
        class="text-sm {conflicts.length > 0
          ? 'text-zinc-400 dark:text-zinc-500'
          : 'text-zinc-500'}"
      >
        {t("course.departments")} {course.dept.join(", ")}
      </div>
    {/if}
    {#if prereqInfo && (prereqInfo.prereqs.length > 0 || prereqInfo.consent || prereqInfo.gpa)}
      {#if prereqInfo.prereqs.length > 0}
        <div
          class="text-sm {conflicts.length > 0
            ? 'text-zinc-400 dark:text-zinc-500'
            : 'text-zinc-500 dark:text-zinc-400'}"
        >
          {t("course.prerequisite")} {prereqInfo.prereqs.join(", ")}
        </div>
      {/if}
      {#if prereqInfo.consent}
        <div
          class="text-sm {conflicts.length > 0
            ? 'text-zinc-400 dark:text-zinc-500'
            : 'text-zinc-500 dark:text-zinc-400'}"
        >
          {t("course.consentRequired")}
        </div>
      {/if}
      {#if prereqInfo.gpa}
        <div
          class="text-sm {conflicts.length > 0
            ? 'text-zinc-400 dark:text-zinc-500'
            : 'text-zinc-500 dark:text-zinc-400'}"
        >
          {t("course.minGpa")} {prereqInfo.gpa}
        </div>
      {/if}
    {/if}
    {#if prereqInfo && prereqInfo.prereqs.length > 0}
      <button
        type="button"
        class="text-xs cursor-pointer {conflicts.length > 0
          ? 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
          : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}"
        onclick={() => (treeExpanded = !treeExpanded)}
      >
        {treeExpanded ? t("course.hideTree") : t("course.showTree")} {treeExpanded ? "▲" : "▼"}
      </button>
      {#if treeExpanded}
        <PrereqTree
          code={base}
          prereqMap={prereqMap}
          isCompleted={(c) => completedSet.has(c)}
          onclose={() => (treeExpanded = false)}
        />
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
            <div class="mt-1">{t("course.catalogPrerequisite")} {descriptionInfo.prerequisite}</div>
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
        {descriptionExpanded ? t("course.hideDescription") : t("course.showDescription")}
      </button>
    {/if}
  </div>
  <div class="flex flex-col items-end shrink-0">
    <div class="flex flex-col-reverse sm:flex-row">
      <button
        type="button"
        title={isCompleted(base) ? t("course.markNotTaken") : t("course.markTaken")}
        class="self-center mr-0 mt-2 sm:mr-2 sm:mt-0 text-xs cursor-pointer {isCompleted(base)
          ? 'text-green-600 dark:text-green-400'
          : 'text-zinc-400 hover:text-green-600 dark:text-zinc-500 dark:hover:text-green-400'}"
        onclick={() => toggleCompleted(base)}
      >
        ✓
      </button>
      <a
        href={reportIssueUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={t("report.tooltip")}
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
