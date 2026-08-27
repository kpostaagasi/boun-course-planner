<script lang="ts">
  import { onMount } from "svelte";
  import {
    getRoadmap,
    addToRoadmap,
    removeFromRoadmap,
    clearRoadmap,
    getCompletedCourseSet,
    getPrereqsAll,
    getOfferings,
    getSemesterData,
    loadPrereqs,
    loadCompleted,
    loadRoadmap,
    loadOfferings,
    getCurrentSemester,
  } from "./globalState.svelte";
  import {
    checkRoadmapPrereqs,
    courseCatalog,
    termLoad,
    sortTermsNewestFirst,
  } from "./roadmapLogic";
  import type { CourseCatalog, RoadmapPrereqReport } from "./roadmapLogic";
  import {
    compareTerms,
    predictOffering,
    predictedCourses,
    synthesiseFutureTerms,
    toDisplayKey,
    toFileKey,
  } from "./futureTerms";
  import type { OfferingConfidence, OfferingPrediction } from "./futureTerms";
  import IconX from "./icons/IconX.svelte";
  import { t, getLang } from "./i18n.svelte";

  /**
   * Load state of one card:
   * - "loading"     published term, dataset in flight
   * - "published"   published term with its real course list in `data`
   * - "unavailable" published term whose dataset failed to load
   * - "predicted"   term BOUN has not published; offerings are inferred
   * Only "published" is ground truth. The other three carry no course list of
   * their own, and the card says so.
   */
  type TermStatus = "loading" | "published" | "predicted" | "unavailable";

  type TermInfo = {
    /** term key in "YYYY/YYYY-T" form */
    term: string;
    /** file key in "YYYY-YYYY-T" form */
    fileKey: string;
    status: TermStatus;
    /** THIS term's course map keyed by section name ("CMPE150.1"); never another term's */
    data: Record<string, CourseInfo> | null;
  };

  type CourseInfo = {
    code?: string;
    name?: string;
    credits?: number | string;
    [key: string]: unknown;
  };

  const SEASON: Record<string, { en: string; tr: string }> = {
    "1": { en: "Fall", tr: "Güz" },
    "2": { en: "Spring", tr: "Bahar" },
    "3": { en: "Summer", tr: "Yaz" },
  };

  const CONFIDENCE_CLASS: Record<OfferingConfidence, string> = {
    known: "border-green-600/40 text-green-700 dark:text-green-400",
    high: "border-green-600/40 text-green-700 dark:text-green-400",
    medium: "border-amber-600/40 text-amber-700 dark:text-amber-400",
    low: "border-orange-600/40 text-orange-700 dark:text-orange-400",
    none: "border-red-600/40 text-red-600 dark:text-red-400",
  };

  const MAX_UPCOMING_TERMS = 6;
  const SUGGESTION_LIMIT = 8;

  let terms = $state<TermInfo[]>([]);
  let termsLoading = $state(true);
  /** newest term BOUN has published; bounds every offering prediction */
  let newestPublished = $state("");
  let addQuery = $state<Record<string, string>>({});
  let openDropdown = $state<string | null>(null);

  // Ensure roadmap/completed/prereqs/offerings state is loaded before deriving
  // flags. Offerings drive the predictions for unpublished terms.
  loadRoadmap();
  loadCompleted();
  loadPrereqs();
  loadOfferings();

  onMount(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/semesters.json`);
      if (!res.ok) return;
      const raw: unknown = await res.json();
      const published = Array.isArray(raw)
        ? raw.filter((x): x is string => typeof x === "string")
        : [];
      if (published.length === 0) return;

      const byNewest = sortTermsNewestFirst(published);
      newestPublished = byNewest[0];

      // getCurrentSemester() uses file-key form ("2026-2027-1"); roadmap terms
      // use "YYYY/YYYY-T".
      const current = getCurrentSemester();
      const currentTerm = current ? toDisplayKey(current) : byNewest[0];

      // semesters.json only ever lists terms BOUN has already published, so
      // there is normally nothing after the current one. Take whatever future
      // terms it does list, then synthesise the rest of the board.
      const publishedUpcoming = byNewest
        .filter((term) => compareTerms(term, currentTerm) > 0)
        .reverse()
        .slice(0, MAX_UPCOMING_TERMS);
      const newestKnown =
        publishedUpcoming.length > 0
          ? publishedUpcoming[publishedUpcoming.length - 1]
          : currentTerm;
      const synthesised = synthesiseFutureTerms(
        newestKnown,
        MAX_UPCOMING_TERMS - publishedUpcoming.length,
      );

      const publishedSet = new Set(published.map(toDisplayKey));
      // Chronological, current term first, so a prereq chain reads left to right.
      terms = [currentTerm, ...publishedUpcoming, ...synthesised].map(
        (term): TermInfo => ({
          term,
          fileKey: toFileKey(term),
          status: publishedSet.has(term) ? "loading" : "predicted",
          data: null,
        }),
      );
      for (const info of terms) {
        if (info.status === "loading") void loadTermData(info);
      }
    } catch {
      // semesters.json unavailable: nothing to show
    } finally {
      termsLoading = false;
    }
  });

  async function loadTermData(info: TermInfo): Promise<void> {
    // The catalogue pane has usually already downloaded the current term.
    const cached = getSemesterData()[info.fileKey];
    if (cached) {
      info.data = cached as Record<string, CourseInfo>;
      info.status = "published";
      return;
    }
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}data/${info.fileKey}.json`,
      );
      if (!res.ok) throw new Error(String(res.status));
      info.data = (await res.json()) as Record<string, CourseInfo>;
      info.status = "published";
    } catch {
      // A published term whose dataset is missing has NO course list. Falling
      // back to another term's data (as this used to) reports offerings that
      // were never announced for this term.
      info.data = null;
      info.status = "unavailable";
    }
  }

  /** True when this card's course list is inference, not BOUN's word. */
  function isInferred(info: TermInfo): boolean {
    return info.status !== "published";
  }

  const catalogs = $derived.by<Record<string, CourseCatalog>>(() => {
    // Newest known dataset first, so the fallback catalogue used by terms with
    // no data of their own resolves to the most recent known offering.
    const known = terms
      .filter((info) => info.data !== null)
      .sort((a, b) => compareTerms(b.term, a.term))
      .map((info) => info.data);
    const fallback = courseCatalog(known);
    const out: Record<string, CourseCatalog> = {};
    for (const info of terms) {
      out[info.term] = info.data ? courseCatalog([info.data]) : fallback;
    }
    return out;
  });

  function catalogFor(info: TermInfo): CourseCatalog {
    return catalogs[info.term] ?? {};
  }

  const orderedTermsOldestFirst = $derived(terms.map((info) => info.term));

  const prereqReport = $derived.by<RoadmapPrereqReport>(() =>
    checkRoadmapPrereqs(
      getRoadmap(),
      orderedTermsOldestFirst,
      getCompletedCourseSet(),
      getPrereqsAll() ?? {},
    ),
  );

  function termDisplay(term: string): string {
    const m = /^(\d{4})\/(\d{4})-(\d)$/.exec(term);
    if (!m) return term;
    const season = SEASON[m[3]];
    const label = season ? season[getLang()] : `Term ${m[3]}`;
    return `${m[1]}/${m[2]} ${label}`;
  }

  type RoadmapCourse = {
    code: string;
    name: string;
    ok: boolean;
    missing: string[];
    /** null on a published term, where the course list is ground truth */
    offering: OfferingPrediction | null;
  };

  function courseRows(info: TermInfo): RoadmapCourse[] {
    const report = prereqReport[info.term] ?? {};
    const catalog = catalogFor(info);
    const offerings = isInferred(info) ? getOfferings() : null;
    return (getRoadmap()[info.term] ?? []).map((code) => {
      const flag = report[code] ?? { ok: true, missing: [] };
      return {
        code,
        name: catalog[code]?.name ?? "",
        ok: flag.ok,
        missing: flag.missing,
        offering: offerings
          ? predictOffering(offerings[code] ?? [], info.term, {
              horizonTerm: newestPublished,
            })
          : null,
      };
    });
  }

  function loadFor(info: TermInfo) {
    return termLoad(info.term, getRoadmap(), catalogFor(info));
  }

  type Suggestion = {
    code: string;
    name: string;
    /** null on a published term: the course is genuinely offered */
    confidence: OfferingConfidence | null;
  };

  function suggestions(term: string): Suggestion[] {
    const q = (addQuery[term] ?? "").trim().toUpperCase();
    if (!q) return [];
    const info = terms.find((x) => x.term === term);
    if (!info) return [];
    const catalog = catalogFor(info);
    if (isInferred(info)) {
      // No published list for this term: offer what history says could run,
      // strongest evidence first, each labelled with its confidence.
      return predictedCourses(getOfferings(), term, {
        prefix: q,
        limit: SUGGESTION_LIMIT,
        horizonTerm: newestPublished,
      }).map(({ code, prediction }) => ({
        code,
        name: catalog[code]?.name ?? "",
        confidence: prediction.confidence,
      }));
    }
    const out: Suggestion[] = [];
    for (const [code, entry] of Object.entries(catalog)) {
      if (code.toUpperCase().startsWith(q)) {
        out.push({ code, name: entry.name, confidence: null });
      }
    }
    return out
      .sort((a, b) => a.code.localeCompare(b.code))
      .slice(0, SUGGESTION_LIMIT);
  }

  function addSuggestion(term: string, code: string): void {
    addToRoadmap(term, code);
    addQuery[term] = "";
    openDropdown = null;
  }

  function onAddInputFocusOrType(term: string): void {
    openDropdown = term;
  }

  function onAddBlur(term: string): void {
    if (openDropdown === term) openDropdown = null;
  }

  function badgeLabel(info: TermInfo): string {
    return info.status === "unavailable"
      ? t("roadmap.unavailable")
      : t("roadmap.predicted");
  }

  function statusNote(info: TermInfo): string {
    if (info.status === "predicted") return t("roadmap.predictedNote");
    if (info.status === "unavailable") return t("roadmap.unavailableNote");
    return "";
  }

  /** Spell out the evidence, so a guess never reads like a fact. */
  function offeringDetail(p: OfferingPrediction): string {
    const parts = [t(`roadmap.conf.${p.confidence}`)];
    if (p.seasonCount > 0) {
      parts.push(`${t("roadmap.seasonCount")}: ${p.seasonCount}`);
    } else if (p.count > 0) {
      parts.push(`${t("roadmap.otherSeasonsOnly")}: ${p.count}`);
    }
    const lastKnown = p.lastSeasonTerm ?? p.lastTerm;
    if (lastKnown) {
      parts.push(
        `${t("roadmap.lastOffered")}: ${termDisplay(toDisplayKey(lastKnown))}`,
      );
    }
    return parts.join(" · ");
  }
</script>

<div
  class="mt-4 shadow bg-white dark:bg-zinc-800 dark:text-white rounded-lg overflow-hidden shrink-0"
  data-testid="roadmap-panel"
>
  <div class="py-2 px-4 bg-zinc-50 dark:bg-zinc-700 flex items-center">
    <span class="font-medium">{t("roadmap.title")}</span>
    <button
      type="button"
      class="ml-auto text-xs px-2 py-0.5 rounded border border-blue-600/50 dark:border-blue-400/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-pointer"
      onclick={clearRoadmap}
    >
      {t("roadmap.clear")}
    </button>
  </div>

  <div class="flex gap-3 overflow-x-auto p-3">
    {#if termsLoading}
      <div class="text-zinc-500 text-sm px-2 py-6">…</div>
    {:else if terms.length === 0}
      <div class="text-zinc-500 text-sm px-2 py-6">—</div>
    {:else}
      {#each terms as info (info.term)}
        {@const rows = courseRows(info)}
        {@const load = loadFor(info)}
        {@const inferred = isInferred(info)}
        {@const note = statusNote(info)}
        <div
          class="min-w-[16rem] w-64 shrink-0 bg-zinc-50 dark:bg-zinc-900 border rounded-lg flex flex-col {inferred
            ? 'border-dashed border-amber-500/60'
            : 'border-gray-200 dark:border-zinc-600'}"
          data-testid="roadmap-term-card"
          data-term={info.term}
          data-status={info.status}
          data-predicted={String(inferred)}
        >
          <div class="py-2 px-3 bg-zinc-100 dark:bg-zinc-700 rounded-t-lg">
            <div class="flex items-center gap-1">
              <span class="font-medium text-sm">{termDisplay(info.term)}</span>
              {#if inferred}
                <span
                  class="ml-auto shrink-0 text-[10px] uppercase tracking-wide px-1 rounded border border-amber-600/50 text-amber-700 dark:text-amber-400"
                  data-testid="roadmap-predicted-badge"
                >
                  {badgeLabel(info)}
                </span>
              {/if}
            </div>
            {#if note}
              <div class="text-xs text-amber-600 dark:text-amber-400">{note}</div>
            {/if}
          </div>

          <div class="divide-y divide-gray-200 dark:divide-zinc-500 flex-1">
            {#if rows.length === 0}
              <div class="text-zinc-500 text-xs h-10 flex items-center justify-center px-2">
                {t("roadmap.empty")}
              </div>
            {:else}
              {#each rows as row (row.code)}
                <div
                  class="py-1 px-2 flex items-center gap-1"
                  data-testid="roadmap-row"
                  data-code={row.code}
                  data-prereq-ok={String(row.ok)}
                >
                  <button
                    type="button"
                    aria-label={row.code}
                    class="shrink-0 cursor-pointer text-zinc-600 dark:text-zinc-400"
                    onclick={() => removeFromRoadmap(info.term, row.code)}
                  >
                    <IconX />
                  </button>
                  <span class="min-w-0 flex-1 truncate" title="{row.code}{row.name ? ' — ' + row.name : ''}">
                    <span class="font-medium">{row.code}</span>{#if row.name}<span class="text-xs text-zinc-500 dark:text-zinc-400">&nbsp;— {row.name}</span>{/if}
                  </span>
                  {#if row.offering}
                    <span
                      class="shrink-0 text-[10px] px-1 rounded border {CONFIDENCE_CLASS[
                        row.offering.confidence
                      ]}"
                      data-testid="roadmap-confidence"
                      data-code={row.code}
                      data-confidence={row.offering.confidence}
                      title={offeringDetail(row.offering)}
                    >
                      {t(`roadmap.conf.${row.offering.confidence}`)}
                    </span>
                  {/if}
                  <span
                    class="shrink-0 text-xs font-medium {row.ok
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-amber-600 dark:text-amber-400'}"
                    title={row.ok
                      ? t("roadmap.prereqOk")
                      : `${t("roadmap.prereqUnmet")}: ${row.missing.join(", ")}`}
                  >
                    {row.ok ? "✓" : "⚠"}
                  </span>
                </div>
              {/each}
            {/if}
          </div>
          <div
            class="py-1 px-3 text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700/60"
            data-testid="roadmap-load"
          >
            {#if inferred}<span title={t("roadmap.estimatedLoad")}>≈</span>{/if}
            {load.credits} {t("roadmap.credits")} · {load.ects} ECTS
            {#if load.overload}
              <div class="text-red-500 text-xs" data-testid="roadmap-overload">
                {t("roadmap.overload")}
              </div>
            {/if}
          </div>

          <div class="relative py-2 px-2 border-t border-gray-200 dark:border-zinc-600">
            <input
              type="text"
              class="w-full text-xs rounded border border-gray-300 dark:border-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 outline-none focus:border-blue-500 dark:focus:border-blue-400 placeholder:text-zinc-400"
              placeholder={t("roadmap.addCourse")}
              data-testid="roadmap-add"
              bind:value={addQuery[info.term]}
              onfocus={() => onAddInputFocusOrType(info.term)}
              onblur={() => onAddBlur(info.term)}
              oninput={() => onAddInputFocusOrType(info.term)}
            />
            {#if openDropdown === info.term}
              {@const found = suggestions(info.term)}
              {#if found.length > 0}
                <div class="absolute left-2 right-2 bottom-full mb-1 z-10 max-h-56 overflow-y-auto rounded border border-gray-200 dark:border-zinc-500 bg-white dark:bg-zinc-800 shadow-lg divide-y divide-gray-100 dark:divide-zinc-700">
                  {#each found as s (s.code)}
                    <button
                      type="button"
                      class="block w-full text-left px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
                      data-testid="roadmap-suggestion"
                      data-code={s.code}
                      data-confidence={s.confidence}
                      onmousedown={(e) => e.preventDefault()}
                      onclick={() => addSuggestion(info.term, s.code)}
                    >
                      <span class="font-medium">{s.code}</span>
                      {#if s.name}<span class="ml-1 text-zinc-500 dark:text-zinc-400">{s.name}</span>{/if}
                      {#if s.confidence}<span
                          class="ml-1 text-[10px] px-1 rounded border {CONFIDENCE_CLASS[
                            s.confidence
                          ]}">{t(`roadmap.conf.${s.confidence}`)}</span
                        >{/if}
                    </button>
                  {/each}
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
