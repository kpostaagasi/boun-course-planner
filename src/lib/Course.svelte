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
   * One disclosure per card holds everything a student does not need in the
   * first two seconds: exam schedule, prerequisite chain, cross-listings,
   * catalogue text, the syllabus link, the report link, the completed toggle.
   *
   * The card above it answers "can I get this section and does it fit"; this
   * answers everything else, on demand. Nothing was removed to get here — the
   * previous card rendered up to eleven stacked rows plus four repeating
   * action buttons on every one of a term's 3140 sections.
   */
  let detailsOpen = $state(false);

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
  One catalogue row.

  Two seconds is the budget: a student in add-drop is scanning for the section
  that is still gettable and does not clash. So the face of the card carries
  exactly the facts that answer that — code, title, who teaches it, when, where,
  how many seats are left and how old that number is — plus any alert that would
  change the decision. Everything else is one tap away under `Details`.

  The row's first <span> is the section key, and the whole row is the hover
  target that highlights the matching block in the timetable.
-->
<div
  class="px-3 py-3 transition-colors hover:bg-zinc-50 sm:px-4 dark:hover:bg-zinc-900/40"
  data-testid="course-row"
  onmouseenter={() => setHoveredCourse(courseName)}
  role="listitem"
>
  <div class="flex items-start gap-3">
    <div class="min-w-0 grow">
      <!-- Identity. The section key is mono because the registration system
           produced it and students type it verbatim. -->
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          class="u-data text-[0.9375rem] font-semibold text-zinc-900 dark:text-zinc-50"
          >{courseName}</span
        >
        <span class="min-w-0 text-sm break-words text-zinc-700 dark:text-zinc-300"
          >{course.name}</span
        >
        {#if eligibility.status === "taken"}
          <span
            class="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[0.6875rem] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            title={t("course.eligibleTitle")}
          >
            <IconCheck />{t("course.taken")}
          </span>
        {/if}
        {#if conflicts.length > 0}
          <!-- The one thing that can make an otherwise perfect section useless. -->
          <span
            class="inline-flex shrink-0 items-center rounded-full bg-red-50 px-2 py-0.5 text-[0.6875rem] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300"
            title={conflicts.join(", ")}>{t("course.conflict")}</span
          >
        {/if}
      </div>

      <!-- The practical line: who, when, where, how much. Separated by
           whitespace rather than by dots — one less mark per row, times 3140. -->
      <div
        class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-zinc-600 dark:text-zinc-400"
      >
        {#if instructorSearchable}
          <button
            type="button"
            class="inline-flex min-h-6 cursor-pointer items-center text-left transition-colors hover:text-blue-600 dark:hover:text-blue-300"
            data-testid="course-instructor"
            title={t("course.searchInstructor")}
            onclick={() => setSearchQuery(course.instructor)}
          >
            {course.instructor}
          </button>
        {:else}
          <!-- "STAFF STAFF": searching for it returns 82 unrelated sections. -->
          <span>{course.instructor}</span>
        {/if}
        {#if scheduleLabel}
          <span class="u-data text-zinc-700 dark:text-zinc-300">{scheduleLabel}</span>
        {/if}
        {#if roomLabel}
          <span class="u-data">{roomLabel}</span>
        {/if}
        {#if "credits" in course}
          <span class="u-data">{course.credits} cr</span>
        {/if}
      </div>

      <!-- Missing prerequisites change whether the section is even takeable, so
           this one stays on the face of the card; everything else the
           prerequisite crawl knows is under Details. -->
      {#if eligibility.status === "missing-prereq"}
        <div class="mt-1 text-[0.8125rem] text-amber-700 dark:text-amber-300">
          {t("course.needs")}
          {eligibility.missing.join(", ")}{eligibility.moreMissing ? "…" : ""}
        </div>
      {/if}

      {#if quotaScrapedAt}
        <!--
          Rendered only when quota.json is loaded, dated, and scraped for the term
          on screen — otherwise there is nothing to report and an "unknown" row on
          every card would be noise. Within that gate, a section we hold no record
          for still gets a row, because "we do not know" is information and a blank
          space is not.
        -->
        <div class="mt-1.5" data-testid="course-quota">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[0.8125rem]">
            {#if quota.kind === "enrolment" && quota.quota !== null && quota.current !== null}
              <span
                class="u-data font-medium text-zinc-900 dark:text-zinc-100"
                data-testid="course-quota-state"
              >
                {t("quota.seats", { current: quota.current, quota: quota.quota })}
              </span>
              {#if quota.overEnrolled}
                <span class="font-medium text-red-600 dark:text-red-400">
                  {t("quota.over", { n: quota.current - quota.quota })}
                </span>
              {:else if quota.full}
                <span class="font-medium text-red-600 dark:text-red-400"
                  >{t("quota.full")}</span
                >
              {:else}
                <span class="text-green-700 dark:text-green-400">
                  {t("quota.left", { n: quota.quota - quota.current })}
                </span>
              {/if}
            {:else if quota.kind === "note-only"}
              <!--
                No numeric allocation: the verbatim cell IS the registration rule.
                It is on 99.4% of the current term's sections before registration
                opens, mandatory first-year courses included, so it is shown as
                written rather than paraphrased into a seat count we do not have.
              -->
              <span
                class="text-zinc-700 dark:text-zinc-300"
                data-testid="course-quota-state">{quota.notes.join(" · ")}</span
              >
            {:else if quota.kind === "capacity-only" && quota.cap !== null}
              <span class="text-zinc-700 dark:text-zinc-300" data-testid="course-quota-state">
                {t("quota.capacity", { cap: quota.cap })}
              </span>
            {:else}
              <span class="text-zinc-500 italic dark:text-zinc-400" data-testid="course-quota-state"
                >{t("quota.noData")}</span
              >
            {/if}
            <!--
              Amber claims one thing: this number may already have moved.
              Enrolment only moves while registration or add-drop is open, so
              the threshold is the term's first day of classes rather than a
              flat 24 hours — which fired on every row, all year, and taught
              the reader to ignore the one colour that matters in registration
              week.
            -->
            <span
              class="text-xs {quotaStale
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-zinc-500 dark:text-zinc-400'}"
              title={t("quota.scrapedTitle", { time: quotaClock })}
            >
              {t("quota.asOf", { time: quotaClock })}
            </span>
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
              class="meter mt-1.5 {quota.overEnrolled || quota.full
                ? 'text-red-500 dark:text-red-400'
                : ratio >= 0.85
                  ? 'text-amber-500 dark:text-amber-300'
                  : 'text-green-500 dark:text-green-400'}"
              style="--fill:{Math.min(ratio, 1)};--over:{Math.min(
                Math.max(ratio - 1, 0),
                1,
              )}"
              data-testid="course-quota-meter"
              data-ratio={ratio.toFixed(3)}
              aria-hidden="true"
            ></div>
          {/if}
        </div>
      {/if}

      <!--
        Exam facts are blank for a whole term until the registrar publishes
        finals, so these rows cost nothing out of season and are exactly what a
        student needs in January. A clash between two *selected* sections is an
        alert and is coloured; the schedule itself is reference and is not.
      -->
      {#if "deliveryMethod" in course || "examDate" in course || "examSlot" in course || "finalExamLocation" in course}
        <div
          class="mt-1 flex flex-wrap gap-x-3 text-[0.8125rem] text-zinc-600 dark:text-zinc-400"
          data-testid="course-exam"
        >
          {#if "deliveryMethod" in course}
            <span>{t("course.delivery")} {course.deliveryMethod}</span>
          {/if}
          {#if "examDate" in course}
            <span>{t("course.finalExam")} {course.examDate}</span>
          {/if}
          {#if "examSlot" in course}
            <span>· {t("course.examSession")} {course.examSlot}</span>
          {/if}
          {#if "finalExamLocation" in course}
            <span>{t("course.examLocation")} {course.finalExamLocation}</span>
          {/if}
        </div>
      {/if}
      {#if examStatus.status === "clash"}
        <div
          class="mt-1 text-[0.8125rem] font-medium text-red-600 dark:text-red-400"
          data-testid="course-exam-clash"
        >
          {t("course.examClash", { keys: examStatus.with.join(", ") })}
        </div>
      {:else if examStatus.status === "maybe"}
        <div
          class="mt-1 text-[0.8125rem] text-amber-700 dark:text-amber-400"
          data-testid="course-exam-clash"
        >
          {t("course.examMaybeClash", { keys: examStatus.with.join(", ") })}
        </div>
      {:else if examStatus.status === "clear" && examStatus.compared > 0}
        <!-- The only status that licenses a positive claim: every pair was decidable. -->
        <div
          class="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
          data-testid="course-exam-clear"
        >
          {t("course.examNoClash")}
        </div>
      {/if}

      <!--
        The fold. One control per card instead of the eleven stacked reference
        rows and four repeating icon buttons that used to ship on every section.
      -->
      <button
        type="button"
        class="btn-text mt-2"
        data-testid="course-details-toggle"
        aria-expanded={detailsOpen}
        onclick={() => (detailsOpen = !detailsOpen)}
      >
        {detailsOpen ? t("course.hideDetails") : t("course.details")}
        <span class="inline-block {detailsOpen ? 'rotate-180' : ''}"
          ><IconChevronDown /></span
        >
      </button>

      {#if detailsOpen}
        <div
          class="mt-2 space-y-2 border-t border-zinc-100 pt-2.5 text-[0.8125rem] text-zinc-600 dark:border-zinc-700/60 dark:text-zinc-400"
          data-testid="course-details"
        >
          <!-- Prerequisites, in one block: what the crawl knows, what it does
               not, and what this particular student is still missing. -->
          <div>
            <span class="font-medium text-zinc-900 dark:text-zinc-100"
              >{t("course.eligibility")}</span
            >
            {#if eligibility.status === "taken"}
              <span class="ml-1">{t("course.eligibleTitle")}</span>
            {:else if eligibility.status === "eligible"}
              <span class="ml-1">{t("course.eligible")}</span>
            {:else if eligibility.status === "missing-prereq"}
              <span class="ml-1 text-amber-700 dark:text-amber-300"
                >{t("course.needs")} {eligibility.missing.join(", ")}</span
              >
            {:else if prereqMap}
              <!--
                The remaining status is "no-data", and the map being loaded narrows
                that to one meaning: this course was never part of the prerequisite
                crawl (314 of the current term's 1324 courses). Saying nothing here
                made an unverified course look identical to a checked one, which is
                how a card could imply eligibility it had never established.
              -->
              <span class="ml-1 italic" data-testid="course-prereq-unknown"
                >{t("course.prereqUnknownTitle")}</span
              >
            {/if}
          </div>

          {#if prereqInfo && prereqInfo.prereqs.length > 0}
            <div>
              {t("course.prerequisite")}
              <span class="u-data">{prereqInfo.prereqs.join(", ")}</span>
              <button
                type="button"
                class="btn-text ml-2"
                aria-expanded={treeExpanded}
                onclick={() => (treeExpanded = !treeExpanded)}
              >
                {treeExpanded ? t("course.hideTree") : t("course.showTree")}
                <span class="inline-block {treeExpanded ? 'rotate-180' : ''}"
                  ><IconChevronDown /></span
                >
              </button>
            </div>
            {#if treeExpanded}
              <PrereqTree
                code={base}
                {prereqMap}
                isCompleted={(c) => completedSet.has(c)}
                onclose={() => (treeExpanded = false)}
              />
            {/if}
          {/if}
          {#if prereqInfo?.consent}
            <div>{t("course.consentRequired")}</div>
          {/if}
          {#if prereqInfo?.gpa}
            <div>{t("course.minGpa")} {prereqInfo.gpa}</div>
          {/if}

          <!-- Registration rules attached to the seat allocation. A handful of
               sections (POR101.01, POR201.01) mix a numeric row with a consent
               row, and dropping the note lost the rule attached to the same
               section. -->
          {#if quotaScrapedAt}
            {#if quota.kind === "enrolment" && quota.notes.length > 0}
              <div>{quota.notes.join(" · ")}</div>
            {/if}
            {#if quota.cap !== null && quota.kind !== "capacity-only"}
              <div>{t("quota.capacity", { cap: quota.cap })}</div>
            {/if}
            {#if quota.kind === "capacity-only"}
              <div class="italic">{t("quota.enrolmentUnpublished")}</div>
            {/if}
            {#if quota.restricted}
              <div>{t("quota.restricted", { depts: quota.depts.join(", ") })}</div>
            {/if}
            {#if quota.surnameRestricted}
              <div>{t("quota.surname")}</div>
            {/if}
          {/if}

          {#if "requiredForDept" in course}
            <div>
              {t("course.requiredFor")}
              <span class="u-data">{course.requiredForDept.join(", ")}</span>
            </div>
          {/if}
          <!--
            Only shown when it says something the course code does not. For 93% of
            sections `dept` is a single entry equal to the code's own letter prefix,
            so "Departments: AD" under AD432.01 was pure restatement.
          -->
          {#if departmentsWorthShowing}
            <div>
              {t("course.departments")}
              <span class="u-data">{course.dept.join(", ")}</span>
            </div>
          {/if}
          {#if offeringHistory}
            <div>
              {t("course.offeredTerms").replace("{n}", String(offeringHistory.count))}
            </div>
          {/if}
          {#if "ects" in course}
            <div><span class="u-data">{course.ects}</span> ECTS</div>
          {/if}

          {#if canShowDescription}
            {#if descriptionExpanded}
              <div class="whitespace-pre-line">
                {#if descriptionInfo?.description}
                  {descriptionInfo.description}
                  {#if descriptionInfo.prerequisite}
                    <div class="mt-1">
                      {t("course.catalogPrerequisite")}
                      {descriptionInfo.prerequisite}
                    </div>
                  {/if}
                {:else}
                  <!-- The catalogue is loaded and has nothing for this code: say
                       so, rather than collapsing the control and leaving a dead tap. -->
                  <span class="italic" data-testid="course-description-none"
                    >{t("course.descriptionNone")}</span
                  >
                {/if}
              </div>
            {/if}
            <button
              type="button"
              class="btn-text"
              data-testid="course-description-toggle"
              aria-expanded={descriptionExpanded}
              disabled={descriptionLoading}
              onclick={toggleDescription}
            >
              {#if descriptionLoading}
                {t("catalogue.loading")}
              {:else}
                {descriptionExpanded
                  ? t("course.hideDescription")
                  : t("course.showDescription")}
                <span class="inline-block {descriptionExpanded ? 'rotate-180' : ''}"
                  ><IconChevronDown /></span
                >
              {/if}
            </button>
          {/if}

          <!-- The three actions that are not "add this section". They repeated on
               every row of a 3140-section catalogue; here they are named rather
               than left as bare icons, which is also what makes them reachable on
               touch and by screen reader. -->
          <div class="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              class="btn-quiet"
              aria-pressed={isCompleted(base)}
              data-testid="course-mark-taken"
              onclick={() => toggleCompleted(base)}
            >
              <IconCheck />
              {isCompleted(base) ? t("course.markNotTaken") : t("course.markTaken")}
            </button>
            <a
              class="btn-quiet"
              href={syllabusLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconDocument />
              {t("course.syllabusLink")}
            </a>
            <a
              class="btn-quiet"
              href={reportIssueUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="course-report"
            >
              <IconWarning />
              {t("report.tooltip")}
            </a>
          </div>
        </div>
      {/if}
    </div>

    <!--
      The one action the row exists for. A single 44px target instead of the
      four that used to stack here — the other three moved under Details, where
      they are labelled instead of guessed at from an icon.
    -->
    <div class="shrink-0">
      {#if selected}
        <button
          type="button"
          aria-label={t("course.removeSection")}
          title={t("course.removeSection")}
          data-testid="course-remove"
          class="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:bg-zinc-700/60 dark:text-zinc-300 dark:hover:bg-red-900/40 dark:hover:text-red-300"
          onclick={() => delCourse(courseName)}
        >
          <IconMinus />
        </button>
      {:else}
        <button
          type="button"
          aria-label={t("course.addSection")}
          title={t("course.addSection")}
          data-testid="course-add"
          class="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          onclick={() => addCourse(courseName)}
        >
          <IconPlus />
        </button>
      {/if}
    </div>
  </div>
</div>
