<script lang="ts">
  import Course from "./Course.svelte";
  import Footer from "./Footer.svelte";
  import InstructorPanel from "./InstructorPanel.svelte";
  import IconSearch from "./icons/IconSearch.svelte";
  import IconX from "./icons/IconX.svelte";
  import IconChevronDown from "./icons/IconChevronDown.svelte";
  import {
    getSearchedCourseNames,
    getSelectedCourseNames,
    getCurSemesterData,
    getCurSemCategories,
    getSearchQuery,
    getCurrentSemester,
    getIsDayHourFilterApplied,
    areDescriptionsLoaded,
    resetDayHourFilter,
  } from "./globalState.svelte";
  import { setHoveredCourse, setSearchQuery } from "./globalState.svelte";
  import { onMount } from "svelte";
  import CourseFilters from "./CourseFilters.svelte";
  import { openCommandPalette } from "./CommandPalette.svelte";
  import {
    buildInstructorIndex,
    findInstructors,
    matchInstructorQuery,
  } from "./instructors";
  import { t } from "./i18n.svelte";

  let input: HTMLInputElement;
  let courseCatalogue: HTMLDivElement | null = $state(null);

  function blurOnEnter(e: KeyboardEvent) {
    if (e.code === "Enter") {
      input.blur();
    }
  }

  function searchFormSubmit(e: Event) {
    e.preventDefault();
    input.blur();
  }

  const pageSize = 20;
  let page = $state(1);
  let isLoading = $state(false);

  // ---- Instructor mode ----
  //
  // `instructor` is on 100% of sections, but the search chain can only ever
  // approximate a person: it ORs the space-separated tokens of the query and
  // consults `instructor` only when the course-code branch came back empty.
  // Measured against the 703 real instructors of 2026/2027-1, feeding a raw
  // name into it returns exactly the right sections for 139 of them; 556 also
  // drag in other people's sections (worst case: 1514 of the 3140 sections),
  // and for 8 — "İLHAN OR", "ÜLFET ZEYNEP ATA", "N. ELİF ULUĞ" and friends —
  // the code branch matches POR/ATA/… courses first, so *none* of their own
  // sections come back. So a query that names somebody exactly takes a
  // different path: the person's own section list, straight from the index.
  //
  // The trigger is deliberately the query itself rather than local state, so
  // clicking the instructor on a course card (which just calls
  // setSearchQuery) lands here too, as does pasting a name or reloading a
  // shared URL. Matching runs on the normalised key, so every scraped
  // spelling of the same person resolves to the same entry.
  const instructorIndex = $derived.by(() => {
    const data = getCurSemesterData();
    const term = getCurrentSemester();
    if (!data || !term) return null;
    return buildInstructorIndex([{ term, data }]);
  });

  // Both of these read `instructorIndex` only once the query is long enough to
  // be a name, and deriveds are lazy, so the index (≈13 ms for 3140 sections)
  // is built at most once per term and never on an empty search box.
  const instructorQuery = $derived(getSearchQuery().trim());
  const activeInstructor = $derived.by(() => {
    const index = instructorQuery.length < 3 ? null : instructorIndex;
    return index ? matchInstructorQuery(index, instructorQuery) : null;
  });
  const instructorMatches = $derived.by(() => {
    if (instructorQuery.length < 3 || activeInstructor !== null) return [];
    const index = instructorIndex;
    return index ? findInstructors(index, instructorQuery) : [];
  });

  const visibleCourseNames = $derived(
    activeInstructor
      ? activeInstructor.sections.map((section) => section.sectionKey)
      : getSearchedCourseNames()
  );

  const hasMorePages = $derived(visibleCourseNames.length > page * pageSize);

  function showInstructor(display: string) {
    // The exact scraped spelling is what turns the query into a person.
    setSearchQuery(display);
    page = 1;
  }

  let isLargeScreen = $state(false);
  // Collapsed by default: the fold exists precisely so 85 department chips are
  // not the first decision of a fresh session, and shipping it open undid that
  // on line one.
  let isExpanded = $state(false);

  function loadMore() {
    if (isLoading || !hasMorePages) return;

    isLoading = true;
    page += 1;
    isLoading = false;
  }

  function infiniteScroll(node: HTMLElement, rootEl: HTMLElement | null) {
    const createObserver = (root: HTMLElement | null) => {
      return new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !isLoading && hasMorePages) {
            loadMore();
          }
        },
        {
          root: root,
          // Trigger when the element is 300px from the bottom of the viewport
          rootMargin: "0px 0px 300px 0px",
        }
      );
    };

    let observer = createObserver(rootEl);
    observer.observe(node);

    return {
      // This function runs whenever the `rootEl` parameter changes
      update(newRootEl: HTMLElement | null) {
        observer.disconnect();
        observer = createObserver(newRootEl);
        observer.observe(node);
      },
      destroy() {
        observer.disconnect();
      },
    };
  }

  onMount(() => {
    // Corresponds to Tailwind's `md` breakpoint
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    // Handler to update the state
    const handleResize = (e: MediaQueryListEvent) => {
      isLargeScreen = e.matches;
    };

    // Set the initial value
    isLargeScreen = mediaQuery.matches;

    // Listen for changes
    mediaQuery.addEventListener("change", handleResize);

    // Cleanup on component destroy
    return () => {
      mediaQuery.removeEventListener("change", handleResize);
    };
  });
</script>

<!-- Search sits at the top of the browsing pane and owns the whole width; the
     filter dialog is the only thing allowed to share the line with it. -->
<div class="flex w-full shrink-0 grow-0 items-center gap-2">
  <div class="relative grow">
    <div
      class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400"
    >
      <IconSearch />
    </div>

    <form onsubmit={searchFormSubmit}>
      <input
        bind:this={input}
        class="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pr-11 pl-11 text-[0.9375rem] text-zinc-900 placeholder-zinc-400 shadow-xs transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        type="text"
        value={getSearchQuery()}
        oninput={(e) => {
          setSearchQuery((e.currentTarget as HTMLInputElement).value ?? "");
          page = 1;
        }}
        placeholder={t("search.placeholder")}
        autocomplete="off"
        autocorrect="off"
        autocapitalize="none"
        spellcheck="false"
        enterkeyhint="search"
        onkeyup={blurOnEnter}
      />
      <!-- Getting back to the browse view used to mean deleting the query by
           hand, character by character, on a phone. -->
      {#if getSearchQuery() !== ""}
        <button
          type="button"
          class="absolute top-1/2 right-1.5 inline-flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
          aria-label={t("search.clear")}
          title={t("search.clear")}
          data-testid="search-clear"
          onclick={() => {
            setSearchQuery("");
            page = 1;
            input.focus();
          }}
        >
          <IconX />
        </button>
      {/if}
    </form>
  </div>

  <!--
    Docked beside the search field, not floating over the list.

    This used to be a `fixed` button in the bottom-right corner — the same
    corner where every catalogue row keeps its Add button. At 360px it covered
    67% of one and swallowed the tap; on the desktop, where the catalogue pane
    scrolls under it, 48%. A fixed overlay above a scrolling list of controls
    collides with whichever row happens to be beneath it, so no amount of
    padding or repositioning fixes it — it has to stop floating.

    Here it is always reachable, on a phone too, and it sits next to the field
    it is a shortcut for.
  -->
  <button
    type="button"
    class="u-data flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-zinc-200 bg-white text-[0.6875rem] font-semibold text-zinc-600 shadow-xs transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white"
    title={t("palette.openTitle")}
    aria-label={t("palette.openTitle")}
    data-testid="palette-open"
    onclick={openCommandPalette}>⌘K</button
  >

  <CourseFilters />
</div>

{#if instructorMatches.length > 0}
  <!-- Discovery path: a partial name offers the people it could mean. Picking
       one replaces the query with that exact scraped spelling, which is what
       switches the list into instructor mode below. -->
  <div
    class="mt-3 flex flex-wrap items-center gap-1.5"
    data-testid="instructor-matches"
  >
    <span class="eyebrow mr-1">{t("instructor.matches")}</span>
    {#each instructorMatches as person (person.key)}
      <button
        type="button"
        class="btn-quiet rounded-full"
        data-testid="instructor-chip"
        title={t("instructor.sections", { n: person.sections.length })}
        onclick={() => showInstructor(person.display)}
      >
        {person.display}
        <span class="u-data text-zinc-500 dark:text-zinc-400"
          >{person.sections.length}</span
        >
      </button>
    {/each}
  </div>
{/if}

{#if activeInstructor}
  <InstructorPanel
    entry={activeInstructor}
    term={getCurrentSemester()}
    onclear={() => {
      setSearchQuery("");
      page = 1;
    }}
  />
{/if}

{#if getCurSemCategories().length > 0 && getSearchQuery() == "" && getIsDayHourFilterApplied() == false}
  <!--
    Departments, as the fastest way into a catalogue of 3140 sections. Folded
    to a single row by default: 85 chips are not a reasonable first decision of
    a fresh session, and the fold is the only thing keeping them from being one.
  -->
  <div class="mt-3 flex items-start gap-2">
    <div
      class={{
        "min-w-0 grow": true,
        "h-[30px] overflow-hidden": !isExpanded,
      }}
    >
      {#each getCurSemCategories() as category (category)}
        <button
          class="u-data mr-1.5 mb-1.5 cursor-pointer rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          onclick={() => {
            setSearchQuery(category);
          }}>{category}</button
        >
      {/each}
    </div>
    {#if getCurSemCategories().length > 5}
      <!-- Beside the row, not floating over it: an overlay toggle covered the
           very chips it was offering to reveal. -->
      <button class="btn-text shrink-0 py-1" onclick={() => (isExpanded = !isExpanded)}>
        {isExpanded ? t("catalogue.showLess") : t("catalogue.showMore")}
        <span class="inline-block {isExpanded ? 'rotate-180' : ''}"
          ><IconChevronDown /></span
        >
      </button>
    {/if}
  </div>
{/if}

{#if visibleCourseNames.length > 0}
  <div
    class="card mt-3 flex shrink flex-col divide-y divide-zinc-100 overflow-x-hidden md:min-h-0 md:overflow-y-auto dark:divide-zinc-700/60"
    data-testid="catalogue"
    onmouseleave={() => setHoveredCourse("")}
    role="list"
    bind:this={courseCatalogue}
  >
    {#each visibleCourseNames.slice(0, pageSize * page) as courseName (courseName)}
      <Course
        {courseName}
        course={getCurSemesterData()[courseName]}
        currentSemester={getCurrentSemester()}
        selected={getSelectedCourseNames().includes(courseName)}
      />
    {/each}

    {#if hasMorePages}
      <div
        role="presentation"
        use:infiniteScroll={isLargeScreen ? courseCatalogue : null}
      >
        {#if isLoading}
          <p class="eyebrow px-4 py-3">{t("catalogue.loading")}</p>
        {/if}
      </div>
    {/if}
  </div>
{:else if getSearchQuery() !== "" || getIsDayHourFilterApplied()}
  <!--
    A search that matches nothing used to render an empty `role="list"` box:
    no message, no way forward, and a list with no listitems on top of that.
    The state now says what was searched and offers the two ways out — the
    same honesty every other absence on the card already gets.

    The last-resort branch of the search fetches descriptions.json before it
    can rule a query out, so an unfinished fetch reports as searching rather
    than as "no matches".
  -->
  <div class="card mt-3 shrink-0 px-4 py-8 text-center" data-testid="catalogue-empty">
    {#if getSearchQuery() !== "" && !areDescriptionsLoaded()}
      <p class="eyebrow">{t("catalogue.emptySearching")}</p>
    {:else}
      <!-- The query is echoed verbatim or not at all — the user has to
           recognise what they actually typed. -->
      <p class="text-[0.9375rem] font-medium text-zinc-900 dark:text-zinc-100">
        {t("catalogue.empty", { query: getSearchQuery() })}
      </p>
      <p class="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
        {t("catalogue.emptyHint")}
      </p>
      {#if getIsDayHourFilterApplied()}
        <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("catalogue.emptyFiltered")}
        </p>
      {/if}
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        {#if getSearchQuery() !== ""}
          <button
            type="button"
            class="btn-quiet"
            data-testid="catalogue-empty-clear"
            onclick={() => {
              setSearchQuery("");
              page = 1;
            }}
          >
            {t("search.clear")}
          </button>
        {/if}
        {#if getIsDayHourFilterApplied()}
          <button
            type="button"
            class="btn-quiet"
            data-testid="catalogue-empty-reset-filters"
            onclick={() => {
              resetDayHourFilter();
              page = 1;
            }}
          >
            {t("catalogue.emptyResetFilters")}
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<div class="block md:hidden">
  <Footer />
</div>
