<script lang="ts">
  import { onMount } from "svelte";
  import {
    getRoadmap,
    addToRoadmap,
    removeFromRoadmap,
    clearRoadmap,
    getCompletedCourses,
    getPrereqsAll,
    loadPrereqs,
    loadCompleted,
    loadRoadmap,
    getCurrentSemester,
  } from "./globalState.svelte";
  import {
    checkRoadmapPrereqs,
    termCredits,
    termEcts,
    sortTermsNewestFirst,
  } from "./roadmapLogic";
  import IconX from "./icons/IconX.svelte";
  import { t, getLang } from "./i18n.svelte";

  type TermInfo = {
    /** term key in "YYYY/YYYY-T" form */
    term: string;
    /** file key in "YYYY-YYYY-T" form */
    fileKey: string;
    /** most recent term with published data; null while loading */
    sourceTerm: string | null;
    /** course map keyed by section name ("CMPE150.1") */
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

  const MAX_UPCOMING_TERMS = 6;

  let terms = $state<TermInfo[]>([]);
  let termsLoading = $state(true);
  let addQuery = $state<Record<string, string>>({});
  let openDropdown = $state<string | null>(null);

  // Ensure roadmap/completed/prereqs state is loaded before deriving flags.
  loadRoadmap();
  loadCompleted();
  loadPrereqs();

  onMount(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/semesters.json`);
      if (!res.ok) return;
      const allTerms: string[] = await res.json();
      if (!Array.isArray(allTerms) || allTerms.length === 0) return;

      // Current semester from global state (falls back to newest available).
      // getCurrentSemester() uses file-key form ("2026-2027-1"); roadmap
      // terms use "YYYY/YYYY-T", so convert back.
      const current = getCurrentSemester();
      const currentTerm = current
        ? current.replace("-", "/")
        : sortTermsNewestFirst(allTerms)[0];

      // Current first, then remaining terms newest-first, excluding terms
      // older than current; at most MAX_UPCOMING_TERMS upcoming.
      const rest = sortTermsNewestFirst(
        allTerms.filter((t) => t !== currentTerm && t >= currentTerm)
      ).slice(0, MAX_UPCOMING_TERMS);

      terms = [currentTerm, ...rest].map((term) => ({
        term,
        fileKey: term.replace("/", "-"),
        sourceTerm: null,
        data: null,
      }));
    } catch {
      // semesters.json unavailable: nothing to show
    } finally {
      termsLoading = false;
    }
  });


  function ensureData(info: TermInfo): void {
    if (info.data || info.sourceTerm === "") return; // loaded or failed
    info.sourceTerm = ""; // in-flight marker
    fetch(`${import.meta.env.BASE_URL}data/${info.fileKey}.json`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        info.data = (await res.json()) as Record<string, CourseInfo>;
        info.sourceTerm = info.term;
      })
      .catch(() => {
        // Unpublished future term: fall back to most recent term WITH data.
        const fallback = [...terms]
          .reverse()
          .find((t) => t.term < info.term && t.data);
        if (fallback) {
          info.sourceTerm = fallback.sourceTerm ?? fallback.term;
          info.data = fallback.data;
        } else {
          info.sourceTerm = "";
          info.data = null;
        }
      });
  }

  $effect(() => {
    for (const info of terms) {
      if (!info.data && info.sourceTerm === null) {
        ensureData(info);
      }
    }
  });

  function termDisplay(term: string): string {
    const m = /^(\d{4})\/(\d{4})-(\d)$/.exec(term);
    if (!m) return term;
    const season = SEASON[m[3]];
    const label = season ? season[getLang()] : `Term ${m[3]}`;
    return `${m[1]}/${m[2]} ${label}`;
  }

  function baseCourses(info: TermInfo): { code: string; name: string }[] {
    if (!info.data) return [];
    const seen = new Set<string>();
    const out: { code: string; name: string }[] = [];
    for (const [sectionName, c] of Object.entries(info.data)) {
      const base = sectionName.split(".")[0];
      if (seen.has(base)) continue;
      seen.add(base);
      out.push({ code: base, name: String(c?.name ?? "") });
    }
    return out.sort((a, b) => a.code.localeCompare(b.code));
  }

  type RoadmapCourse = {
    code: string;
    name: string;
    ok: boolean;
    missing: string[];
    credits: number | undefined;
  };

  function courseRows(info: TermInfo): RoadmapCourse[] {
    const report = prereqReport()[info.term] ?? {};
    return (getRoadmap()[info.term] ?? []).map((code) => {
      const entry =
        Object.entries(info.data ?? {}).find(
          ([sectionName]) => sectionName.split(".")[0] === code
        ) ?? null;
      const flag = report[code] ?? { ok: true, missing: [] };
      return {
        code,
        name: entry ? String(entry[1]?.name ?? "") : "",
        ok: flag.ok,
        missing: flag.missing,
        credits:
          entry && typeof entry[1]?.credits !== "undefined"
            ? Number(entry[1].credits)
            : undefined,
      };
    });
  }

  const orderedTermsOldestFirst = $derived([...terms.map((x) => x.term)].reverse());

  function prereqReport() {
    return checkRoadmapPrereqs(
      getRoadmap(),
      orderedTermsOldestFirst,
      new Set(getCompletedCourses()),
      getPrereqsAll() ?? {}
    );
  }

  function creditsFor(info: TermInfo): number {
    return termCredits(info.term, getRoadmap(), info.data ?? {});
  }

  function ectsFor(info: TermInfo): number {
    return termEcts(info.term, getRoadmap(), info.data ?? {});
  }

  function suggestions(term: string): { code: string; name: string }[] {
    const q = (addQuery[term] ?? "").trim().toUpperCase();
    const info = terms.find((t) => t.term === term);
    if (!info || !q) return [];
    return baseCourses(info)
      .filter((c) => c.code.toUpperCase().startsWith(q))
      .slice(0, 8);
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


  function sourceText(info: TermInfo): string {
    if (info.sourceTerm && info.sourceTerm !== info.term) {
      return `${t("roadmap.fromTerm")} ${termDisplay(info.sourceTerm)}`;
    }
    return "";
  }
</script>

<div class="mt-4 shadow bg-white dark:bg-zinc-800 dark:text-white rounded-lg overflow-hidden shrink-0">
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
        {@const src = sourceText(info)}
        <div
          class="min-w-[16rem] w-64 shrink-0 bg-zinc-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-600 rounded-lg flex flex-col"
        >
          <div class="py-2 px-3 bg-zinc-100 dark:bg-zinc-700 rounded-t-lg">
            <div class="font-medium text-sm">{termDisplay(info.term)}</div>
            {#if src}
              <div class="text-xs text-amber-600 dark:text-amber-400">{src}</div>
            {/if}
          </div>

          <div class="divide-y divide-gray-200 dark:divide-zinc-500 flex-1">
            {#if rows.length === 0}
              <div class="text-zinc-500 text-xs h-10 flex items-center justify-center px-2">
                {t("roadmap.empty")}
              </div>
            {:else}
              {#each rows as row (row.code)}
                <div class="py-1 px-2 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={row.code}
                    class="shrink-0 cursor-pointer text-zinc-600 dark:text-zinc-400"
                    onclick={() => removeFromRoadmap(info.term, row.code)}
                  >
                    <IconX />
                  </button>
                  <span
                    class="ml-auto shrink-0 text-xs font-medium {row.ok
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-amber-600 dark:text-amber-400'}"
                    title={row.ok
                      ? t("roadmap.prereqOk")
                      : `${t("roadmap.prereqUnmet")}: ${row.missing.join(", ")}`}
                  >
                    {row.ok ? "✓" : "⚠"}
                  </span>
                  <span class="ml-2 min-w-0 truncate" title="{row.code}{row.name ? ' — ' + row.name : ''}">
                    <span class="font-medium">{row.code}</span>{#if row.name}<span class="text-xs text-zinc-500 dark:text-zinc-400"> — {row.name}</span>{/if}
                  </span>
                </div>
              {/each}
            {/if}
          </div>
          <div class="py-1 px-3 text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700/60">
            {creditsFor(info)} {t("roadmap.credits")} · {ectsFor(info)} ECTS
            {#if ectsFor(info) > 40}
              <div class="text-red-500 text-xs">{t("roadmap.overload")}</div>
            {/if}
          </div>

          <div class="relative py-2 px-2 border-t border-gray-200 dark:border-zinc-600">
            <input
              type="text"
              class="w-full text-xs rounded border border-gray-300 dark:border-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 outline-none focus:border-blue-500 dark:focus:border-blue-400 placeholder:text-zinc-400"
              placeholder={t("roadmap.addCourse")}
              bind:value={addQuery[info.term]}
              onfocus={() => onAddInputFocusOrType(info.term)}
              onblur={() => onAddBlur(info.term)}
              oninput={() => onAddInputFocusOrType(info.term)}
            />
            {#if openDropdown === info.term && suggestions(info.term).length > 0}
              <div class="absolute left-2 right-2 bottom-full mb-1 z-10 max-h-56 overflow-y-auto rounded border border-gray-200 dark:border-zinc-500 bg-white dark:bg-zinc-800 shadow-lg divide-y divide-gray-100 dark:divide-zinc-700">
                {#each suggestions(info.term) as s (s.code)}
                  <button
                    type="button"
                    class="block w-full text-left px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
                    onmousedown={(e) => e.preventDefault()}
                    onclick={() => addSuggestion(info.term, s.code)}
                  >
                    <span class="font-medium">{s.code}</span>
                    {#if s.name}<span class="ml-1 text-zinc-500 dark:text-zinc-400">{s.name}</span>{/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
