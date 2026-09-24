<script lang="ts">
  import {
    getSelectedCourseNames,
    getCurSemesterData,
    getCurrentSemester,
    getSemesterDates,
    getSemesterDatesFailed,
    loadSemesterDates,
  } from "./globalState.svelte";
  import IconCalendar from "./icons/IconCalendar.svelte";
  import IconX from "./icons/IconX.svelte";
  import { t } from "./i18n.svelte";
  import { uniqueRooms } from "./paletteSearch";

  // Semester data with dates and holidays loaded from JSON
  type SemesterData = {
    start: string;
    end: string;
    holidays?: Holiday[];
  };

  // Holidays data extracted from semester data
  type Holiday = {
    date: string;
    name: string;
    timeType?: "before" | "after" | "between";
    time?: string;
    endTime?: string; // For 'between' type
  };

  // State for showing import instructions
  let showInstructions = $state(false);

  /**
   * Outcome of the `semester-dates.json` fetch, reported from the loader's own
   * failure flag rather than inferred from an empty map.
   *
   * The file covers 6 of the 25 published terms, so "no entry for this term" is
   * the normal case and must not be reported as a failure. A fetch that really
   * fails is a different story, and used to leave the export button disabled
   * behind the misleading "select courses" hint with the only explanation going
   * to `console.error`.
   */
  const datesStatus = $derived<"loading" | "ready" | "failed">(
    getSemesterDatesFailed() ? "failed" : getSemesterDates() ? "ready" : "loading"
  );

  // One shared fetch for the whole app: the timetable's date strip and the
  // course card's quota-staleness rule read the same file. Cast at the
  // boundary because this component needs the stricter holiday shape
  // (`timeType` is a closed union here, not a bare string).
  loadSemesterDates();

  const semesterDates = $derived(
    (getSemesterDates() ?? {}) as Record<string, SemesterData>
  );

  const holidaysData = $derived.by(() => {
    const byTerm: Record<string, Holiday[]> = {};
    for (const [semester, info] of Object.entries(semesterDates)) {
      if (info.holidays) byTerm[semester] = info.holidays;
    }
    return byTerm;
  });

  // Day mapping for ICS format
  const dayMapping: Record<string, string> = {
    M: "MO",
    T: "TU",
    W: "WE",
    Th: "TH",
    F: "FR",
    St: "SA",
  };

  function formatDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  function formatDateOnly(date: Date): string {
    return date.toISOString().split("T")[0].replace(/-/g, "");
  }

  type MeetingBlock = {
    day: string;
    startHour: number;
    endHour: number; // Exclusive: start of the next hour
    location: string;
  };

  // Location for one meeting block. `rooms` is index-aligned with `days` and
  // `hours`, so each block takes only its own slots' rooms; a scraped row
  // whose rooms don't line up falls back to every room of the section.
  function blockLocation(courseInfo: any, slots: number[]): string {
    const rooms: string[] = courseInfo.rooms ?? [];
    const picked =
      rooms.length === courseInfo.days.length
        ? slots.map((i) => rooms[i])
        : rooms;
    const unique = uniqueRooms({ rooms: picked });
    if (unique.length === 0) {
      return "Boğaziçi University";
    }
    if (unique.length === 1 && unique[0] === "Online") {
      return "Online";
    }
    return `${unique.join(", ")}, Boğaziçi University`;
  }

  // Group a section's slots into runs of consecutive hours per day, each
  // carrying the room(s) of its own slots.
  function getMeetingBlocks(courseInfo: any): MeetingBlock[] {
    if (!courseInfo.days || !courseInfo.hours) {
      return [];
    }

    const daySlots: Record<string, number[]> = {};
    for (let i = 0; i < courseInfo.days.length; i++) {
      const day = courseInfo.days[i];
      daySlots[day] = daySlots[day] || [];
      daySlots[day].push(i);
    }

    const blocks: MeetingBlock[] = [];
    Object.entries(daySlots).forEach(([day, slots]) => {
      slots.sort((a, b) => courseInfo.hours[a] - courseInfo.hours[b]);
      let group = [slots[0]];
      const flush = () => {
        blocks.push({
          day,
          startHour: courseInfo.hours[group[0]],
          endHour: courseInfo.hours[group[group.length - 1]] + 1,
          location: blockLocation(courseInfo, group),
        });
      };
      for (let i = 1; i < slots.length; i++) {
        if (courseInfo.hours[slots[i]] === courseInfo.hours[slots[i - 1]] + 1) {
          group.push(slots[i]);
        } else {
          flush();
          group = [slots[i]];
        }
      }
      flush();
    });
    return blocks;
  }

  // ICS TEXT values must escape backslashes, commas, semicolons and newlines
  function escapeICSText(value: string): string {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  function getFirstDayOfWeek(startDate: Date, targetDay: string): Date {
    const dayIndex = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(
      dayMapping[targetDay]
    );
    const startDayIndex = startDate.getDay();
    const diff = (dayIndex - startDayIndex + 7) % 7;
    const firstDay = new Date(startDate);
    firstDay.setDate(startDate.getDate() + diff);
    return firstDay;
  }

  function createCalendarEvent(
    courseName: string,
    courseInfo: any,
    startDate: Date,
    endDate: Date,
    currentSemester: string
  ): string[] {
    const events: string[] = [];

    if (!courseInfo.days || !courseInfo.hours) {
      return events;
    }

    // Get holidays for current semester
    const semesterHolidays = holidaysData[currentSemester] || [];

    // Create a recurring event for each consecutive-hour block
    const dayBlockCounts: Record<string, number> = {};
    getMeetingBlocks(courseInfo).forEach(
      ({ day, startHour, endHour, location }) => {
        const groupIndex = dayBlockCounts[day] ?? 0;
        dayBlockCounts[day] = groupIndex + 1;

        // Find the first occurrence of this day in the semester
        const firstOccurrence = getFirstDayOfWeek(startDate, day);

        // Create start and end DateTime objects for the first occurrence
        const eventStart = new Date(firstOccurrence);
        eventStart.setHours(8 + startHour, 0, 0, 0); // Hours start from 9am (index 1 = 9am)

        const eventEnd = new Date(firstOccurrence);
        eventEnd.setHours(8 + endHour, 0, 0, 0);

        // Generate EXDATE list for holidays that conflict with this class
        const excludeDates = generateExcludeDates(
          startDate,
          endDate,
          day,
          startHour,
          endHour,
          semesterHolidays
        );

        // Generate unique ID
        const uid = `${courseName}-${day}-${startHour}-${groupIndex}-${Date.now()}@boun-course-planner`;

        // Create the recurring event
        const eventLines = [
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTART:${formatDate(eventStart)}`,
          `DTEND:${formatDate(eventEnd)}`,
          `SUMMARY:${courseName}`,
          `DESCRIPTION:Course: ${courseInfo.name || courseName}\\nInstructor: ${courseInfo.instructor || "N/A"}\\nCredits: ${courseInfo.credits || "N/A"}`,
          `LOCATION:${escapeICSText(location)}`,
          `RRULE:FREQ=WEEKLY;UNTIL=${formatDate(new Date(endDate.getTime() + 24 * 60 * 60 * 1000))}`,
        ];

        // Add EXDATE if there are holidays to exclude
        if (excludeDates.length > 0) {
          eventLines.push(`EXDATE:${excludeDates.join(",")}`);
        }

        eventLines.push("END:VEVENT");

        events.push(eventLines.join("\r\n"));
      }
    );

    return events;
  }

  function generateExcludeDates(
    startDate: Date,
    endDate: Date,
    targetDay: string,
    classStartHour: number,
    classEndHour: number,
    holidays: Holiday[]
  ): string[] {
    const excludeDates: string[] = [];
    const firstOccurrence = getFirstDayOfWeek(startDate, targetDay);

    let currentDate = new Date(firstOccurrence);

    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split("T")[0];

      // Check if there's a holiday on this date
      const holiday = holidays.find((h) => h.date === dateString);

      if (holiday) {
        let shouldExclude = false;

        if (!holiday.timeType) {
          // Full day holiday
          shouldExclude = true;
        } else if (holiday.time) {
          // Holiday with time specification - check if class conflicts
          const [holidayHour, holidayMinute] = holiday.time
            .split(":")
            .map(Number);
          const holidayTimeInHours = holidayHour + holidayMinute / 60;

          // Convert class hours to actual time (assuming hour 1 = 9:00 AM)
          const classStartTime = 8 + classStartHour; // Hour 1 = 9:00 AM
          const classEndTime = 8 + classEndHour;

          if (holiday.timeType === "before") {
            // Holiday before specified time - class is cancelled if it starts before holiday time
            if (classStartTime < holidayTimeInHours) {
              shouldExclude = true;
            }
          } else if (holiday.timeType === "after") {
            // Holiday after specified time - class is cancelled if it ends after holiday time
            if (classEndTime > holidayTimeInHours) {
              shouldExclude = true;
            }
          } else if (holiday.timeType === "between" && holiday.endTime) {
            // Holiday between two times
            const [endHour, endMinute] = holiday.endTime.split(":").map(Number);
            const holidayEndTime = endHour + endMinute / 60;

            // Class is cancelled if it overlaps with holiday period
            if (
              !(
                classEndTime <= holidayTimeInHours ||
                classStartTime >= holidayEndTime
              )
            ) {
              shouldExclude = true;
            }
          }
        }

        if (shouldExclude) {
          // Create the exclude date in the same format as the event start time
          const excludeDate = new Date(currentDate);
          excludeDate.setHours(8 + classStartHour, 0, 0, 0);
          excludeDates.push(formatDate(excludeDate));
        }
      }

      // Move to next week
      currentDate.setDate(currentDate.getDate() + 7);
    }

    return excludeDates;
  }

  function generateICS(): string {
    const currentSemester = getCurrentSemester();
    const selectedCourses = getSelectedCourseNames();
    const semesterData = getCurSemesterData();

    if (!currentSemester || !semesterData || selectedCourses.length === 0) {
      return "";
    }

    const semesterDateRange = semesterDates[currentSemester];
    if (!semesterDateRange) {
      alert(t("calendar.alertNoDates", { term: currentSemester }));
      return "";
    }

    const startDate = new Date(semesterDateRange.start);
    const endDate = new Date(semesterDateRange.end);

    let icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BOUN Course Planner//Course Schedule//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:BOUN Course Schedule",
      "X-WR-CALDESC:Course schedule for " + currentSemester,
      "X-WR-TIMEZONE:Europe/Istanbul",
      "BEGIN:VTIMEZONE",
      "TZID:Europe/Istanbul",
      "BEGIN:STANDARD",
      "DTSTART:20071028T040000",
      "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
      "TZNAME:+03",
      "TZOFFSETFROM:+0400",
      "TZOFFSETTO:+0300",
      "END:STANDARD",
      "BEGIN:DAYLIGHT",
      "DTSTART:20070325T030000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
      "TZNAME:+04",
      "TZOFFSETFROM:+0300",
      "TZOFFSETTO:+0400",
      "END:DAYLIGHT",
      "END:VTIMEZONE",
    ].join("\r\n");

    // Generate events for each selected course
    selectedCourses.forEach((courseName) => {
      if (semesterData[courseName]) {
        const events = createCalendarEvent(
          courseName,
          semesterData[courseName],
          startDate,
          endDate,
          currentSemester
        );
        icsContent += "\r\n" + events.join("\r\n");
      }
    });

    icsContent += "\r\nEND:VCALENDAR";
    return icsContent;
  }

  function downloadCalendar() {
    const icsContent = generateICS();
    if (!icsContent) {
      alert(t("calendar.alertNoCourses"));
      return;
    }

    // Create filename
    const filename = `BOUN-${getCurrentSemester()}-schedule.ics`;

    // Create blob with proper MIME type
    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });

    // For modern browsers, use the standard download approach
    // Other browsers
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.style.display = "none";

    // Add to DOM, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the blob URL after a short delay
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }
  // Check if a class hour range conflicts with a holiday's time specification
  function conflictsWithHoliday(
    holiday: Holiday,
    classStartHour: number,
    classEndHour: number,
  ): boolean {
    if (!holiday.timeType) {
      return true; // Full day holiday
    }
    if (!holiday.time) {
      return false;
    }
    const [holidayHour, holidayMinute] = holiday.time.split(":").map(Number);
    const holidayTimeInHours = holidayHour + holidayMinute / 60;

    const classStartTime = 8 + classStartHour;
    const classEndTime = 8 + classEndHour;

    if (holiday.timeType === "before") {
      return classStartTime < holidayTimeInHours;
    }
    if (holiday.timeType === "after") {
      return classEndTime > holidayTimeInHours;
    }
    if (holiday.timeType === "between" && holiday.endTime) {
      const [endHour, endMinute] = holiday.endTime.split(":").map(Number);
      const holidayEndTime = endHour + endMinute / 60;
      return !(
        classEndTime <= holidayTimeInHours ||
        classStartTime >= holidayEndTime
      );
    }
    return false;
  }

  // Build Google Calendar TEMPLATE links for each consecutive-hour group of a course
  function buildGoogleCalendarUrls(
    courseName: string,
    courseInfo: any,
    startDate: Date,
    endDate: Date,
  ): string[] {
    if (!courseInfo.days || !courseInfo.hours) {
      return [];
    }

    const semesterHolidays =
      holidaysData[getCurrentSemester()] || [];

    const urls: string[] = [];

    getMeetingBlocks(courseInfo).forEach(
      ({ day, startHour, endHour, location }) => {
        const firstOccurrence = getFirstDayOfWeek(startDate, day);

        const eventStart = new Date(firstOccurrence);
        eventStart.setHours(8 + startHour, 0, 0, 0);

        const eventEnd = new Date(firstOccurrence);
        eventEnd.setHours(8 + endHour, 0, 0, 0);

        const detailsParts = [
          `Course: ${courseInfo.name || courseName}`,
          `Instructor: ${courseInfo.instructor || "N/A"}`,
          `Credits: ${courseInfo.credits || "N/A"}`,
        ];

        // TEMPLATE links don't support EXDATE; list excluded holidays in the details instead
        const excludedHolidayDates: string[] = [];
        let currentDate = new Date(firstOccurrence);
        while (currentDate <= endDate) {
          const dateString = currentDate.toISOString().split("T")[0];
          const holiday = semesterHolidays.find((h) => h.date === dateString);
          if (
            holiday &&
            conflictsWithHoliday(holiday, startHour, endHour)
          ) {
            excludedHolidayDates.push(dateString);
          }
          currentDate.setDate(currentDate.getDate() + 7);
        }
        if (excludedHolidayDates.length > 0) {
          detailsParts.push(
            `Excluded holidays: ${excludedHolidayDates.join(", ")}`,
          );
        }

        // Floating local times + ctz param; UNTIL keeps the Z-suffixed formatDate format
        const pad = (n: number) => String(n).padStart(2, "0");
        const formatLocalDateTime = (d: Date) =>
          `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
        const rruleUntil = `${formatLocalDateTime(endDate)}Z`;

        const params = [
          "action=TEMPLATE",
          `text=${encodeURIComponent(courseName)}`,
          `dates=${formatLocalDateTime(eventStart)}/${formatLocalDateTime(eventEnd)}`,
          `recur=${encodeURIComponent(`RRULE:FREQ=WEEKLY;UNTIL=${rruleUntil}`)}`,
          `location=${encodeURIComponent(location)}`,
          `details=${encodeURIComponent(detailsParts.join("\n"))}`,
          "ctz=Europe/Istanbul",
        ];

        urls.push(
          `https://calendar.google.com/calendar/render?${params.join("&")}`,
        );
      }
    );

    return urls;
  }

  function openInGoogleCalendar() {
    const currentSemester = getCurrentSemester();
    const selectedCourses = getSelectedCourseNames();
    const semesterData = getCurSemesterData();

    if (!currentSemester || !semesterData || selectedCourses.length === 0) {
      alert(t("calendar.alertNoCourses"));
      return;
    }

    const semesterDateRange = semesterDates[currentSemester];
    if (!semesterDateRange) {
      alert(t("calendar.alertNoDates", { term: currentSemester }));
      return;
    }

    const startDate = new Date(semesterDateRange.start);
    const endDate = new Date(semesterDateRange.end);

    // window.open calls stay synchronous inside this user gesture so popups aren't blocked
    selectedCourses.forEach((courseName) => {
      if (!semesterData[courseName]) {
        return;
      }
      buildGoogleCalendarUrls(
        courseName,
        semesterData[courseName],
        startDate,
        endDate,
      ).forEach((url) => {
        window.open(url, "_blank");
      });
    });
  }

  const hasSelectedCourses = $derived(
    getSelectedCourseNames().length > 0 &&
      !!getCurrentSemester() &&
      !!getCurSemesterData()
  );

  const hasSemesterDates = $derived(
    !!getCurrentSemester() && !!semesterDates[getCurrentSemester()]
  );

  const canExportCalendar = $derived(hasSelectedCourses && hasSemesterDates);

  // Ordered by how actionable the reason is: a failed fetch blocks export no
  // matter what is selected, so it wins over the selection hint.
  const calendarTooltip = $derived(
    canExportCalendar
      ? t("calendar.tooltipIcs")
      : datesStatus === "failed"
        ? t("calendar.datesLoadFailed")
        : !hasSelectedCourses
          ? t("calendar.tooltipSelectCourses")
          : t("calendar.tooltipNoDates")
  );
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      class={canExportCalendar ? "btn-primary" : "btn-quiet"}
      onclick={downloadCalendar}
      disabled={!canExportCalendar}
      title={calendarTooltip}
      data-testid="calendar-ics"
    >
      <IconCalendar />
      {t("calendar.addToCalendar")}
    </button>
    {#if canExportCalendar}
      <button
        type="button"
        class="btn-quiet px-3 py-2 text-sm"
        onclick={openInGoogleCalendar}
        title={t("calendar.addToGcal")}
        data-testid="calendar-gcal"
      >
        <IconCalendar />
        {t("calendar.addToGcal")}
      </button>
    {/if}

    <button
      type="button"
      class="btn-text"
      onclick={() => (showInstructions = !showInstructions)}
    >
      {t("calendar.howToImport")}
    </button>
  </div>

  <!-- Own row, not jammed against How to import: the two used to read as one
       sentence ("Select courses to enable calendar export How to import?").
       A disabled export button with no explanation reads as a broken app, so
       the reason is shown once the fetch has settled; during the in-flight
       moment there is nothing truthful to say yet. -->
  {#if !canExportCalendar && datesStatus !== "loading"}
    <p
      class="text-xs text-zinc-600 dark:text-zinc-400"
      data-testid="calendar-reason"
      data-dates-status={datesStatus}>{calendarTooltip}</p
    >
  {/if}

  {#if showInstructions}
    <div
      class="rounded-xl bg-zinc-50 p-3.5 text-sm dark:bg-zinc-900/60"
    >
      <div class="mb-2 flex items-start justify-between">
        <h4 class="text-[0.8125rem] font-semibold text-zinc-900 dark:text-zinc-100">
          {t("calendar.instructionsTitle")}
        </h4>
        <button
          type="button"
          class="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-white"
          aria-label={t("palette.close")}
          onclick={() => (showInstructions = false)}
        >
          <IconX />
        </button>
      </div>
      <ul class="space-y-1.5 text-[0.8125rem] text-zinc-600 dark:text-zinc-300">
        <li>
          <strong class="font-medium text-zinc-900 dark:text-zinc-100">macOS:</strong>
          {t("instructions.macos")}
        </li>
        <li>
          <strong class="font-medium text-zinc-900 dark:text-zinc-100">Windows:</strong>
          {t("instructions.windows")}
        </li>
        <li>
          <strong class="font-medium text-zinc-900 dark:text-zinc-100">Google Calendar:</strong>
          {t("instructions.gcal")}
        </li>
        <li>
          <strong class="font-medium text-zinc-900 dark:text-zinc-100">Outlook Web:</strong>
          {t("instructions.outlook")}
        </li>
      </ul>
    </div>
  {/if}
</div>
