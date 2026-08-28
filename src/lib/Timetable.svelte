<script lang="ts">
  import {
    getSelectedCourseNames,
    getHoveredCourse,
    getCurSemesterData,
    getCurrentSemester,
  } from "./globalState.svelte";
  import { onMount } from "svelte";
  import { t, getLang } from "./i18n.svelte";
  import {
    DAYS,
    DAY_LABEL_KEYS,
    PALETTE,
    buildTimetableLayout,
  } from "./timetableLayout";
  import type { Layout, Occupant } from "./timetableLayout";
  import IconDownload from "./icons/IconDownload.svelte";

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

  // One pass produces the rows, the Saturday flag and the sub-column
  // allocation together; the old code walked the selection twice.
  const layout = $derived<Layout>(
    getCurrentSemester() != "" && getCurSemesterData()
      ? buildTimetableLayout(
          getSelectedCourseNames(),
          getCurSemesterData(),
          getHoveredCourse()
        )
      : buildTimetableLayout([], null)
  );

  const courseOnSaturday = $derived(layout.courseOnSaturday);
  const hoveredCourse = $derived(getHoveredCourse());
  const selectedCourses = $derived(getSelectedCourseNames());

  /** Percentage geometry for one sub-column. 1px of air guarantees no overlap. */
  function boxStyle(occ: Occupant): string {
    const left = ((occ.col * 100) / occ.cols).toFixed(4);
    const width = (100 / occ.cols).toFixed(4);
    return `left:${left}%;width:calc(${width}% - 1px)`;
  }

  // ---------------------------------------------------------------- PNG export

  const canExportPng = $derived(layout.occupantCount > 0);

  const CANVAS = {
    scale: 2, // 2x so the PNG stays crisp when viewed on a phone
    pad: 14,
    gutterW: 54,
    // Wide enough that a bare section key ("CMPE101.01") fits on one line at
    // 11px, so clashes stay readable instead of hard-breaking mid-code.
    subW: 96,
    minDayW: 130,
    // Every day column shares one width, so the worst clash in the grid must
    // not blow the sheet up to several thousand pixels: past three-way the
    // sub-columns shrink and the font drops instead.
    maxDayW: 264,
    rowH: 34,
    headH: 28,
    titleH: 52,
    footH: 22,
  };

  const SANS =
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  /** Break `text` into at most `maxLines` lines that each fit `maxW`, ellipsising the rest. */
  function fitLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxW: number,
    maxLines: number
  ): string[] {
    const lines: string[] = [];
    let cur = "";
    const flush = () => {
      if (cur !== "") {
        lines.push(cur);
        cur = "";
      }
    };
    for (const word of text.split(/\s+/).filter(Boolean)) {
      let rest = word;
      // A single token wider than the box has to be hard-broken.
      while (ctx.measureText(rest).width > maxW && rest.length > 1) {
        flush();
        let cut = rest.length;
        while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxW) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
        if (lines.length >= maxLines) break;
      }
      if (lines.length >= maxLines) break;
      const candidate = cur === "" ? rest : `${cur} ${rest}`;
      if (cur !== "" && ctx.measureText(candidate).width > maxW) {
        flush();
        cur = rest;
      } else {
        cur = candidate;
      }
    }
    flush();
    if (lines.length > maxLines) lines.length = maxLines;
    const kept = lines.join("").replace(/\s+/g, "");
    if (kept !== text.replace(/\s+/g, "") && lines.length > 0) {
      let last = lines[lines.length - 1];
      while (last.length > 0 && ctx.measureText(`${last}…`).width > maxW) {
        last = last.slice(0, -1);
      }
      lines[lines.length - 1] = `${last}…`;
    }
    return lines;
  }

  /**
   * The PNG is deliberately ALWAYS light, regardless of the app's appearance:
   * it is an artifact people paste into group chats, docs and printouts whose
   * background we do not control, and the dark half of `PALETTE` is a set of
   * translucent overlays that only reads correctly on a dark substrate. A
   * light sheet is legible everywhere.
   */
  function renderPng(): HTMLCanvasElement {
    const days = DAYS.map((_, i) => i).filter(
      (i) => DAYS[i] !== "St" || courseOnSaturday
    );
    const { scale, pad, gutterW, subW, minDayW, maxDayW, rowH, headH, titleH, footH } =
      CANVAS;
    const dayW = Math.min(maxDayW, Math.max(minDayW, layout.maxCols * subW));
    const gridW = gutterW + days.length * dayW;
    const gridH = headH + layout.rows.length * rowH;
    const width = pad * 2 + gridW;
    const height = pad * 2 + titleH + gridH + footH;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    ctx.scale(scale, scale);
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#18181b";
    ctx.font = `700 18px ${SANS}`;
    ctx.textAlign = "left";
    ctx.fillText(t("header.title"), pad, pad + 18);
    ctx.fillStyle = "#71717a";
    ctx.font = `500 13px ${SANS}`;
    ctx.fillText(getCurrentSemester(), pad, pad + 38);

    const x0 = pad;
    const y0 = pad + titleH;

    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(x0, y0, gridW, headH);
    ctx.fillStyle = "#3f3f46";
    ctx.font = `700 12px ${SANS}`;
    ctx.textAlign = "center";
    days.forEach((dayIdx, i) => {
      ctx.fillText(
        t(DAY_LABEL_KEYS[dayIdx]),
        x0 + gutterW + i * dayW + dayW / 2,
        y0 + headH / 2 + 4
      );
    });

    layout.rows.forEach((row, r) => {
      const y = y0 + headH + r * rowH;
      if (r % 2 === 0) {
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(x0, y, gridW, rowH);
      }
      ctx.fillStyle = "#52525b";
      ctx.font = `600 11px ${SANS}`;
      ctx.textAlign = "right";
      ctx.fillText(
        `${String(row.hour).padStart(2, "0")}:00`,
        x0 + gutterW - 7,
        y + rowH / 2 + 4
      );

      days.forEach((dayIdx, i) => {
        const cell = row.cells[dayIdx];
        if (cell.length === 0) return;
        const cx = x0 + gutterW + i * dayW;
        if (cell.length > 1) {
          ctx.fillStyle = "#fee2e2";
          ctx.fillRect(cx, y, dayW, rowH);
          // Outline the clash region, not each row of it, so a multi-hour
          // block is not sliced by red lines at every hour boundary.
          const above = r > 0 && layout.rows[r - 1].cells[dayIdx].length > 1;
          const below =
            r < layout.rows.length - 1 && layout.rows[r + 1].cells[dayIdx].length > 1;
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx + 0.5, y);
          ctx.lineTo(cx + 0.5, y + rowH);
          ctx.moveTo(cx + dayW - 0.5, y);
          ctx.lineTo(cx + dayW - 0.5, y + rowH);
          if (!above) {
            ctx.moveTo(cx, y + 0.5);
            ctx.lineTo(cx + dayW, y + 0.5);
          }
          if (!below) {
            ctx.moveTo(cx, y + rowH - 0.5);
            ctx.lineTo(cx + dayW, y + rowH - 0.5);
          }
          ctx.stroke();
        }
        for (const occ of cell) {
          const entry = PALETTE[occ.color];
          const bw = dayW / occ.cols;
          const bx = cx + occ.col * bw;
          ctx.fillStyle = entry.fill;
          ctx.fillRect(bx + 1, y + 1, bw - 2, rowH - 2);
          ctx.fillStyle = entry.accent;
          ctx.fillRect(bx + 1, y + 1, 3, rowH - 2);
          if (!occ.isFirst) continue;
          const textW = bw - 12;
          ctx.fillStyle = entry.ink;
          ctx.font = `600 ${textW >= 64 ? 11 : 9}px ${SANS}`;
          ctx.textAlign = "left";
          const lineH = textW >= 64 ? 12 : 10;
          const lines = fitLines(ctx, occ.course, textW, Math.floor((rowH - 6) / lineH));
          lines.forEach((line, li) => {
            ctx.fillText(line, bx + 7, y + 12 + li * lineH);
          });
        }
      });
    });

    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let r = 0; r <= layout.rows.length; r++) {
      const y = Math.round(y0 + headH + r * rowH) + 0.5;
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + gridW, y);
    }
    for (let i = 0; i <= days.length; i++) {
      const x = Math.round(x0 + gutterW + i * dayW) + 0.5;
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + gridH);
    }
    ctx.moveTo(x0 + 0.5, y0 + 0.5);
    ctx.lineTo(x0 + 0.5, y0 + gridH);
    ctx.moveTo(x0, y0 + 0.5);
    ctx.lineTo(x0 + gridW, y0 + 0.5);
    ctx.stroke();

    ctx.fillStyle = "#a1a1aa";
    ctx.font = `400 10px ${SANS}`;
    ctx.textAlign = "left";
    ctx.fillText(
      `${location.host}${import.meta.env.BASE_URL}`,
      x0,
      y0 + gridH + footH - 4
    );

    return canvas;
  }

  function downloadPng() {
    if (!canExportPng) return;
    const canvas = renderPng();
    canvas.toBlob((blob) => {
      if (!blob) return;
      // Same anchor + blob-URL dance as CalendarExport's downloadCalendar().
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BOUN-${getCurrentSemester()}-timetable.png`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
    }, "image/png");
  }
</script>

<div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs">
  {#if calendarInfo}
    <span class="text-zinc-600 dark:text-zinc-400">
      {t("timetable.semesterStart")}: {formatDate(calendarInfo.start)}
    </span>
    <span class="text-zinc-600 dark:text-zinc-400">
      {t("timetable.semesterEnd")}: {formatDate(calendarInfo.end)}
    </span>
    {#each calendarInfo.holidays as h}
      <span class="rounded bg-zinc-200 px-1.5 py-0.5 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100">
        {h.name} ({formatDate(h.date)})
      </span>
    {/each}
  {/if}
  <button
    type="button"
    data-testid="timetable-export-png"
    class="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-300 px-2 py-1 text-[0.8125rem] font-medium text-zinc-600 transition-colors hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-blue-400 dark:hover:text-blue-300"
    onclick={downloadPng}
    disabled={!canExportPng}
    title={canExportPng ? t("timetable.exportPng") : t("timetable.exportPngEmpty")}
  >
    <IconDownload />
    {t("timetable.exportPng")}
  </button>
</div>
<div
  data-testid="timetable-scroll"
  class="bg-white dark:bg-zinc-800 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-lg w-full shrink-0 overflow-x-auto"
>
  <table
    class="table-fixed text-center w-full min-w-[32rem] text-sm lg:text-base antialiased tracking-tight sm:tracking-normal"
  >
    <thead>
      <tr>
        <th
          class="sticky left-0 z-40 w-14 border-r border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
        ></th>
        {#each DAYS as day, dayIdx}
          <th
            class="eyebrow w-20 border-b border-zinc-200 pb-1.5 pt-2 dark:border-zinc-700 {day ==
              'St' && !courseOnSaturday
              ? 'hidden'
              : ''}"
          >
            {t(DAY_LABEL_KEYS[dayIdx])}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
    {#each layout.rows as row, i}
      <tr>
        <!--
          The hour spine. Time is the organising principle of the entire product,
          but this column used to be a 16px gutter holding a bare "9". Mono and
          right-aligned so the hours stack into an axis, with the minutes dropped
          to a lighter mark because they are always :00 and never the thing being
          read.
        -->
        <th
          class="spine sticky left-0 z-30 w-14 border-r border-zinc-200 bg-white px-2 align-top dark:border-zinc-700 dark:bg-zinc-800 {i ===
          0
            ? ''
            : 'row-rule'}"
        >
          <span class="inline-block pt-1.5"
            >{String(row.hour).padStart(2, "0")}<span class="spine-min" aria-hidden="true">:00</span></span
          >
        </th>
        {#each DAYS as day, dayIdx}
          {@const cell = row.cells[dayIdx]}
          {@const conflict = cell.length > 1}
          <td
            title={conflict ? t("course.conflict") : undefined}
            aria-label={conflict ? t("course.conflict") : undefined}
            class="relative h-9 p-0 align-top {i === 0 ? '' : 'row-rule'} {day == 'St' &&
            !courseOnSaturday
              ? 'hidden'
              : ''} {conflict
              ? 'bg-red-100 ring-2 ring-red-500 ring-inset dark:bg-red-500/15 dark:ring-red-400'
              : ''}"
            >{#each cell as occ}{@const color = PALETTE[occ.color]}<div
                data-testid="tt-box"
                data-course={occ.course}
                data-hour={row.hour}
                data-day={day}
                title={occ.course}
                style={boxStyle(occ)}
                class="absolute inset-y-0 overflow-hidden border-l-2 px-1 text-left leading-[1.15] text-[10px] sm:text-xs {color.bg} {color.text} {color.border}
                  {occ.isFirst ? 'rounded-tr' : ''} {occ.isLast ? 'rounded-br' : ''}
                  {occ.course == hoveredCourse && !selectedCourses.includes(occ.course)
                  ? 'opacity-75 ring-2 ring-zinc-400 dark:ring-zinc-200'
                  : occ.course == hoveredCourse
                  ? 'ring-2 ring-zinc-400 dark:ring-zinc-200'
                  : ''}"
              >{#if occ.isFirst}{occ.course}{/if}</div
              >{/each}</td
          >
        {/each}
      </tr>
    {/each}
    </tbody>
  </table>
</div>
