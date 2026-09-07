<script lang="ts">
  import IconMinus from "./icons/IconMinus.svelte";
  import PrereqTree from "./PrereqTree.svelte";
  import IconDocument from "./icons/IconDocument.svelte";
  import IconPlus from "./icons/IconPlus.svelte";
  import IconChevronDown from "./icons/IconChevronDown.svelte";
  import IconWarning from "./icons/IconWarning.svelte";
  import IconCheck from "./icons/IconCheck.svelte";
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
    areDescriptionsLoaded,
    ensureDescriptions,
    getSemesterDatesFor,
    loadSemesterDates,
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
  import { quotaDisplay, quotaIsStale } from "./quotaInfo";
  import { examConflictFor, type ExamSection } from "./examConflict";
  import { termHistory } from "./termHistory";
  import { describeSchedule, uniqueRooms, DAY_NAMES } from "./paletteSearch";

  let { course, courseName, currentSemester, selected } = $props();

  // Quota is list-level data — every catalogue row wants it — and `loadQuota`
  // dedupes to a single request, so starting it from card init costs one fetch
  // and keeps it off the first-paint critical path. See `loadQuota` for the
  // payload-budget measurements behind that choice.
  loadQuota();
  // The term's first day of classes decides whether enrolment can still be
  // moving, which is what the staleness stamp below actually claims. Same
  // dedup story as loadQuota: one fetch for the whole app.
  loadSemesterDates();

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
  /**
   * Meeting times as real clock times, e.g. "Mon 11:00–13:50 · Wed 09:00".
   * describeSchedule is the palette's formatter; reusing it keeps one
   * slot-to-clock rule in the codebase instead of two that can drift.
   */
  const scheduleLabel = $derived.by(() => {
    const days: string[] = "days" in course ? course.days : [];
    const hours: number[] = "hours" in course ? course.hours : [];
    if (days.length === 0) return "";
    const dayLabels: Record<string, string> = {};
    for (const code of Object.keys(DAY_NAMES)) {
      dayLabels[code] = t(`day.${DAY_NAMES[code]}`);
    }
    return describeSchedule({ days, hours }, { dayLabels });
  });

  /** Rooms, deduplicated: a three-meeting course repeats one room three times. */
  const roomLabel = $derived(
    "rooms" in course ? uniqueRooms({ rooms: course.rooms }).join(" · ") : "",
  );

  /**
   * True only when `dept` names something the course code does not already say.
   * `base` is e.g. "AD432", so its letter prefix is the owning department for
   * the overwhelming majority of sections.
   */
  const departmentsWorthShowing = $derived.by(() => {
    if (!("dept" in course)) return false;
    const depts: string[] = course.dept;
    if (depts.length === 0) return false;
    const ownPrefix = base.replace(/[0-9].*$/, "");
    return !(depts.length === 1 && depts[0] === ownPrefix);
  });

  let descriptionExpanded = $state(false);
  let treeExpanded = $state(false);
  let descriptionLoading = $state(false);

  /**
   * `descriptions.json` is ~244 KB gzipped and is not in the initial payload,
   * so before it arrives a card cannot know whether this course has catalogue
   * text. Offering the toggle anyway — and fetching on the first click — is
   * what makes the feature reachable at all: the only other trigger was the
   * search's zero-match fallback, so ordinary browsing never revealed it.
   */
  const descriptionsLoaded = $derived(areDescriptionsLoaded());
  const canShowDescription = $derived(
    !descriptionsLoaded || !!descriptionInfo?.description || descriptionExpanded,
  );

  async function toggleDescription() {
    if (descriptionExpanded) {
      descriptionExpanded = false;
      return;
    }
    if (!areDescriptionsLoaded()) {
      descriptionLoading = true;
      await ensureDescriptions();
      descriptionLoading = false;
    }
    descriptionExpanded = true;
  }

  /**
   * The card's explanations used to live only in `title` attributes, which
   * never fire on touch — the surface PRODUCT.md calls a primary case — and are
   * skipped by screen-reader navigation. Each mark is now a real disclosure
   * button writing its sentence here, and the sentence renders as text.
   */
  let hint = $state("");

  function toggleHint(text: string) {
    hint = hint === text ? "" : text;
  }

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
  /**
   * Amber on the "as of" stamp claims one thing: this number may already have
   * moved. Enrolment only moves while registration or add-drop is open, so the
   * threshold is judged against the term's first day of classes rather than
   * against a flat 24 hours — which fired on every row, all year, and taught
   * the reader to ignore the one colour that matters in registration week.
   */
  const quotaStale = $derived(
    quotaIsStale(quotaScrapedAt, getSemesterDatesFor(currentSemester)?.start ?? null),
  );
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

<!--
  Zebra striping is gone. Two alternating surface tints fought the occupancy
  meter for attention and made a dense list read as banded rather than as rows;
  the list's own hairline divider separates them, and hover carries the pointer.
-->
<div
  class="py-2.5 px-4 flex flex-row bg-white dark:bg-zinc-800 dark:text-white transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
  onmouseenter={() => setHoveredCourse(courseName)}
  role="listitem"
>
  <div
    class="grow {conflicts.length > 0
      ? 'text-zinc-600 dark:text-zinc-400'
      : ''}"
  >
    <div class="flex items-baseline flex-wrap gap-x-2.5">
      <span class="u-data text-[0.9375rem] font-semibold text-zinc-900 dark:text-zinc-100">{courseName}</span
      ><span class="text-sm text-zinc-600 dark:text-zinc-300 break-words">{course.name}</span>
      <span class="ml-auto flex items-baseline gap-x-2 shrink-0">
        {#if conflicts.length > 0}
          <span class="eyebrow text-red-600 dark:text-red-400" title={conflicts.join(", ")}
            >{t("course.conflict")}</span
          >
        {/if}
        <span class="u-data text-[0.6875rem] text-zinc-600 dark:text-zinc-400">
          {#if "credits" in course}<span>{course.credits}cr</span>{/if}{#if "ects" in course}<span
              class="ml-1.5">{course.ects}ects</span
            >{/if}{#if offeringHistory}<span
              class="ml-1.5"
              title={t("course.offeredTerms").replace("{n}", String(offeringHistory.count))}
              >{offeringHistory.count}×</span
            >{/if}
        </span>
        {#if eligibility.status === "taken"}
          <button
            type="button"
            class="u-data inline-flex min-h-6 cursor-pointer items-center gap-1 text-[0.6875rem] font-semibold text-blue-600 dark:text-blue-300"
            title={t("course.eligibleTitle")}
            aria-expanded={hint === t("course.eligibleTitle")}
            onclick={() => toggleHint(t("course.eligibleTitle"))}
          >
            <IconCheck />{t("course.taken")}
          </button>
        {:else if eligibility.status === "eligible"}
          <!--
            "Eligible" is the default state of nearly every row, so spelling it
            out on all of them was noise, and a decorative green broke the rule
            that saturated colour means scarcity. The signal survives as a mark
            with the wording in the accessible name — and as a disclosure,
            because a `title` alone never reaches a touch or screen-reader user.
          -->
          <button
            type="button"
            class="inline-flex min-h-6 cursor-pointer items-center text-blue-500/70 dark:text-blue-300/70"
            title={t("course.eligibleTitle")}
            aria-label={t("course.eligible")}
            aria-expanded={hint === t("course.eligibleTitle")}
            onclick={() => toggleHint(t("course.eligibleTitle"))}
          >
            <span class="inline-block size-1.5 rounded-full bg-current"></span>
          </button>
        {:else if eligibility.status === "missing-prereq"}
          <span
            class="u-data text-[0.6875rem] text-amber-500 dark:text-amber-300"
            title={eligibility.missing.join(", ")}
            >{t("course.needs")} {eligibility.missing.join(", ")}{eligibility.moreMissing
              ? "…"
              : ""}</span
          >
        {:else if prereqMap}
          <!--
            The remaining status is "no-data", and the map being loaded narrows
            that to one meaning: this course was never part of the prerequisite
            crawl (314 of the current term's 1324 courses). Rendering nothing here
            made an unverified course look identical to a checked one, which is how
            a card could imply eligibility it had never established.
          -->
          <button
            type="button"
            class="inline-flex min-h-6 cursor-pointer items-center text-[0.6875rem] italic text-zinc-600 dark:text-zinc-400"
            data-testid="course-prereq-unknown"
            title={t("course.prereqUnknownTitle")}
            aria-expanded={hint === t("course.prereqUnknownTitle")}
            onclick={() => toggleHint(t("course.prereqUnknownTitle"))}
          >
            ? {t("course.prereqUnknown")}
          </button>
        {/if}
      </span>
    </div>
    <div class="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]">
      {#if instructorSearchable}
        <button
          type="button"
          class="min-h-6 py-0.5 text-left cursor-pointer text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-300 hover:underline decoration-1 underline-offset-2"
          data-testid="course-instructor"
          title={t("course.searchInstructor")}
          onclick={() => setSearchQuery(course.instructor)}
        >
          {course.instructor}
        </button>
      {:else}
        <!-- "STAFF STAFF": searching for it returns 82 unrelated sections. -->
        <span class="text-zinc-600 dark:text-zinc-400">{course.instructor}</span>
      {/if}
      <!--
        The days/hours/rooms line used to be three emoji-prefixed fragments
        (calendar/clock/house emoji + MMM 345 BM A2) which rendered differently on every OS and left
        the reader to decode slot digits. describeSchedule already turns the same
        arrays into real clock times for the palette, so it is reused here rather
        than reimplemented, and the result is set in mono because it is data the
        registration system produced.
      -->
      {#if scheduleLabel}
        <span class="u-data text-zinc-600 dark:text-zinc-400">{scheduleLabel}</span>
      {/if}
      {#if roomLabel}
        <span class="u-data text-zinc-600 dark:text-zinc-400">{roomLabel}</span>
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
        class="text-[0.8125rem] flex flex-wrap items-baseline gap-x-2 {conflicts.length > 0
          ? 'text-zinc-600 dark:text-zinc-400'
          : 'text-zinc-600 dark:text-zinc-400'}"
        data-testid="course-quota"
      >
        {#if quota.kind === "enrolment" && quota.quota !== null && quota.current !== null}
          <span class="u-data" data-testid="course-quota-state">
            {t("quota.seats", { current: quota.current, quota: quota.quota })}
          </span>
          {#if quota.overEnrolled}
            <span class="font-medium text-red-600 dark:text-red-400">
              {t("quota.over", { n: quota.current - quota.quota })}
            </span>
          {:else if quota.full}
            <span class="font-medium text-red-600 dark:text-red-400">{t("quota.full")}</span>
          {:else}
            <span class="text-green-600 dark:text-green-400">
              {t("quota.left", { n: quota.quota - quota.current })}
            </span>
          {/if}
          {#if quota.cap !== null}
            <span class="text-xs">{t("quota.capacity", { cap: quota.cap })}</span>
          {/if}
          {#if quota.notes.length > 0}
            <!--
              A handful of sections (POR101.01, POR201.01) mix a numeric row
              with a consent row. The numbers win the display, but dropping the
              note lost the registration rule attached to the same section.
            -->
            <button
              type="button"
              class="inline-flex min-h-6 cursor-pointer items-center text-xs"
              title={t("quota.noteTitle")}
              aria-expanded={hint === t("quota.noteTitle")}
              onclick={() => toggleHint(t("quota.noteTitle"))}
            >
              {quota.notes.join(" · ")}
            </button>
          {/if}
        {:else if quota.kind === "note-only"}
          <!--
            No numeric allocation: the verbatim cell IS the registration rule.
            It is on 99.4% of the current term's sections before registration
            opens, mandatory first-year courses included, so it says whose
            wording it is — read raw, "Consent Of Instructor" on Calculus I
            reads as "email this professor" rather than "no quota published yet".
          -->
          <button
            type="button"
            class="inline-flex min-h-6 cursor-pointer items-center text-left"
            data-testid="course-quota-state"
            title={t("quota.noteTitle")}
            aria-expanded={hint === t("quota.noteTitle")}
            onclick={() => toggleHint(t("quota.noteTitle"))}
          >
            {quota.notes.join(" · ")}
          </button>
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
        <button
          type="button"
          class="inline-flex min-h-6 cursor-pointer items-center text-xs {quotaStale
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-zinc-600 dark:text-zinc-400'}"
          title={t("quota.scrapedTitle", { time: quotaClock })}
          aria-expanded={hint === t("quota.scrapedTitle", { time: quotaClock })}
          onclick={() => toggleHint(t("quota.scrapedTitle", { time: quotaClock }))}
        >
          {t("quota.asOf", { time: quotaClock })}
        </button>
      </div>
      <!--
        The occupancy meter. The one place this design is allowed to be loud,
        because whether a section is gettable is the question the whole app
        exists to answer, and no other BOUN tool answers it. The fill is
        current/quota; past 100% it keeps going into a hatched tail rather than
        clamping, so an over-enrolled section looks over-enrolled instead of
        merely looking finished.
      -->
      {#if quota.kind === "enrolment" && quota.quota !== null && quota.current !== null && quota.quota > 0}
        {@const ratio = quota.current / quota.quota}
        <div
          class="meter mt-1 {quota.overEnrolled || quota.full
            ? 'text-red-500 dark:text-red-400'
            : ratio >= 0.85
              ? 'text-amber-400 dark:text-amber-300'
              : 'text-green-500 dark:text-green-400'}"
          style="--fill:{Math.min(ratio, 1)};--over:{Math.min(Math.max(ratio - 1, 0), 1)}"
          data-testid="course-quota-meter"
          data-ratio={ratio.toFixed(3)}
          aria-hidden="true"
        ></div>
      {/if}
    {/if}
    {#if "deliveryMethod" in course || "examDate" in course || "examSlot" in course || "finalExamLocation" in course}
      <!--
        The registrar leaves all four cells blank until the exam schedule is
        published, so these are strictly conditional: no empty rows out of season.
      -->
      <div
        class="text-sm {conflicts.length > 0
          ? 'text-zinc-600 dark:text-zinc-400'
          : 'text-zinc-600 dark:text-zinc-400'}"
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
      <div class="text-xs text-zinc-600 dark:text-zinc-400" data-testid="course-exam-clear">
        {t("course.examNoClash")}
      </div>
    {/if}
    {#if "requiredForDept" in course}
      <div
        class="text-[0.8125rem] {conflicts.length > 0
          ? 'text-zinc-600 dark:text-zinc-400'
          : 'text-zinc-600 dark:text-zinc-400'}"
      >
        {t("course.requiredFor")}
        <span class="u-data">{course.requiredForDept.join(", ")}</span>
      </div>
    {/if}
    <!--
      Only shown when it says something the course code does not. For 93% of
      sections `dept` is a single entry equal to the code's own letter prefix, so
      "Departments: AD" under AD432.01 was a line of pure restatement on almost
      every row. Cross-listed courses, where it names a department you could not
      have guessed, still get it.
    -->
    {#if departmentsWorthShowing}
      <div
        class="text-[0.8125rem] {conflicts.length > 0
          ? 'text-zinc-600 dark:text-zinc-400'
          : 'text-zinc-600 dark:text-zinc-400'}"
      >
        {t("course.departments")}
        <span class="u-data">{course.dept.join(", ")}</span>
      </div>
    {/if}
    {#if prereqInfo && (prereqInfo.prereqs.length > 0 || prereqInfo.consent || prereqInfo.gpa)}
      {#if prereqInfo.prereqs.length > 0}
        <div
          class="text-sm {conflicts.length > 0
            ? 'text-zinc-600 dark:text-zinc-400'
            : 'text-zinc-600 dark:text-zinc-400'}"
        >
          {t("course.prerequisite")} {prereqInfo.prereqs.join(", ")}
        </div>
      {/if}
      {#if prereqInfo.consent}
        <div
          class="text-sm {conflicts.length > 0
            ? 'text-zinc-600 dark:text-zinc-400'
            : 'text-zinc-600 dark:text-zinc-400'}"
        >
          {t("course.consentRequired")}
        </div>
      {/if}
      {#if prereqInfo.gpa}
        <div
          class="text-sm {conflicts.length > 0
            ? 'text-zinc-600 dark:text-zinc-400'
            : 'text-zinc-600 dark:text-zinc-400'}"
        >
          {t("course.minGpa")} {prereqInfo.gpa}
        </div>
      {/if}
    {/if}
    {#if prereqInfo && prereqInfo.prereqs.length > 0}
      <button
        type="button"
        class="min-h-6 py-0.5 text-xs cursor-pointer {conflicts.length > 0
          ? 'text-zinc-600 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300'
          : 'text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-300'}"
        aria-expanded={treeExpanded}
        onclick={() => (treeExpanded = !treeExpanded)}
      >
        {treeExpanded ? t("course.hideTree") : t("course.showTree")}
        <span class="inline-block {treeExpanded ? 'rotate-180' : ''}"><IconChevronDown /></span>
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
    {#if canShowDescription}
      {#if descriptionExpanded}
        <div
          class="mt-1 text-sm whitespace-pre-line {conflicts.length > 0
            ? 'text-zinc-600 dark:text-zinc-400'
            : 'text-zinc-600 dark:text-zinc-400'}"
        >
          {#if descriptionInfo?.description}
            {descriptionInfo.description}
            {#if descriptionInfo.prerequisite}
              <div class="mt-1">
                {t("course.catalogPrerequisite")} {descriptionInfo.prerequisite}
              </div>
            {/if}
          {:else}
            <!-- The catalogue is loaded and has nothing for this code: say so,
                 rather than collapsing the control and leaving a dead tap. -->
            <span class="italic" data-testid="course-description-none"
              >{t("course.descriptionNone")}</span
            >
          {/if}
        </div>
      {/if}
      <button
        type="button"
        class="min-h-6 py-0.5 text-xs cursor-pointer {conflicts.length > 0
          ? 'text-zinc-600 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300'
          : 'text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-300'}"
        data-testid="course-description-toggle"
        aria-expanded={descriptionExpanded}
        disabled={descriptionLoading}
        onclick={toggleDescription}
      >
        {#if descriptionLoading}
          {t("catalogue.loading")}
        {:else}
          {descriptionExpanded ? t("course.hideDescription") : t("course.showDescription")}
          <span class="inline-block {descriptionExpanded ? 'rotate-180' : ''}"
            ><IconChevronDown /></span
          >
        {/if}
      </button>
    {/if}
    {#if hint}
      <!--
        One annotation slot per card, always in the same place: the marks above
        are disclosures, and their sentence has to land somewhere a touch user
        can read it. Hairline, not a tooltip — nothing in this system floats.
      -->
      <p
        class="mt-1.5 border-t border-zinc-100 pt-1.5 text-xs text-zinc-600 dark:border-zinc-700/60 dark:text-zinc-400"
        data-testid="course-hint"
      >
        {hint}
      </p>
    {/if}
  </div>
  <!--
    Four controls that repeat on every row of a thousands-of-section catalogue,
    on the form factor PRODUCT.md names for "decisions in seconds on whatever
    device is at hand". They were 10x16 and 14x16 CSS px on a 390 px viewport;
    every one is now a 44 px touch target that relaxes to the denser desktop
    size above `sm`, and the two that had no accessible name have one. Four
    stacked 44 px targets would have made every phone row ~190 px tall, so on
    touch they sit in a 2x2 block instead of a column.
  -->
  <div class="flex flex-col items-end shrink-0">
    <div class="grid grid-cols-2 place-items-center gap-1 sm:flex sm:flex-row sm:items-center sm:gap-0">
      <button
        type="button"
        aria-label={isCompleted(base) ? t("course.markNotTaken") : t("course.markTaken")}
        aria-pressed={isCompleted(base)}
        title={isCompleted(base) ? t("course.markNotTaken") : t("course.markTaken")}
        class="inline-flex size-11 cursor-pointer items-center justify-center rounded-md sm:mr-2 sm:size-9 {isCompleted(
          base,
        )
          ? 'text-blue-600 dark:text-blue-300'
          : 'text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-300'}"
        data-testid="course-mark-taken"
        onclick={() => toggleCompleted(base)}
      >
        <IconCheck />
      </button>
      <a
        href={reportIssueUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("report.tooltip")}
        title={t("report.tooltip")}
        class="inline-flex size-11 items-center justify-center rounded-md text-zinc-600 hover:text-blue-600 sm:mr-2 sm:size-9 dark:text-zinc-400 dark:hover:text-blue-300"
        data-testid="course-report"
      >
        <IconWarning />
      </a>
      <a
        href={syllabusLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("course.syllabusLink")}
        title={t("course.syllabusLink")}
        class="inline-flex size-11 items-center justify-center rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-800 sm:mr-2 sm:size-9 dark:bg-blue-900 dark:text-blue-400 dark:hover:bg-blue-800 dark:hover:text-blue-200"
      >
        <IconDocument />
      </a>
      {#if selected}
        <button
          type="button"
          aria-label={t("course.removeSection")}
          title={t("course.removeSection")}
          class="inline-flex size-11 cursor-pointer items-center justify-center rounded-md bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-800 sm:size-9 dark:bg-red-900 dark:text-red-400 dark:hover:bg-red-800 dark:hover:text-red-200"
          onclick={() => delCourse(courseName)}
        >
          <IconMinus />
        </button>
      {:else}
        <button
          type="button"
          aria-label={t("course.addSection")}
          title={t("course.addSection")}
          class="inline-flex size-11 cursor-pointer items-center justify-center rounded-md bg-green-100 text-green-600 hover:bg-green-200 hover:text-green-800 sm:size-9 dark:bg-green-900 dark:text-green-400 dark:hover:bg-green-800 dark:hover:text-green-200"
          onclick={() => addCourse(courseName)}
        >
          <IconPlus />
        </button>
      {/if}
    </div>
  </div>
</div>
