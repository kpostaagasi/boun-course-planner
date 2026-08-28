<script lang="ts">
  import Course from "./Course.svelte";
  import Footer from "./Footer.svelte";
  import InstructorPanel from "./InstructorPanel.svelte";
  import IconSearch from "./icons/IconSearch.svelte";
  import IconChevronDown from "./icons/IconChevronDown.svelte";
  import {
    getSearchedCourseNames,
    getSelectedCourseNames,
    getCurSemesterData,
    getCurSemCategories,
    getSearchQuery,
    getCurrentSemester,
    getIsDayHourFilterApplied,
  } from "./globalState.svelte";
  import { setHoveredCourse, setSearchQuery } from "./globalState.svelte";
  import { onMount } from "svelte";
  import CourseFilters from "./CourseFilters.svelte";
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
  let isExpanded = $state(true);

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

<div class="grow-0 shrink-0 w-full flex items-center">
  <div class="relative shadow rounded-lg overflow-hidden grow">
    <div
      class="text-zinc-600 dark:text-zinc-300 absolute top-1/2 transform -translate-y-1/2 left-3"
    >
      <IconSearch />
    </div>

    <form onsubmit={searchFormSubmit}>
      <input
        bind:this={input}
        class="w-full rounded-md border border-zinc-200 bg-white py-1.5 pl-10 pr-3 text-zinc-900 placeholder-zinc-400 antialiased transition-colors focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
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
    </form>
  </div>

  <CourseFilters />
</div>

{#if instructorMatches.length > 0}
  <!-- Discovery path: a partial name offers the people it could mean. Picking
       one replaces the query with that exact scraped spelling, which is what
       switches the list into instructor mode below. -->
  <div
    class="mt-4 flex flex-wrap items-center gap-1"
    data-testid="instructor-matches"
  >
    <span class="text-xs text-zinc-600 dark:text-zinc-400 mr-1"
      >{t("instructor.matches")}</span
    >
    {#each instructorMatches as person (person.key)}
      <button
        type="button"
        class="btn-quiet rounded-full"
        data-testid="instructor-chip"
        title={t("instructor.sections", { n: person.sections.length })}
        onclick={() => showInstructor(person.display)}
      >
        {person.display}
        <span class="text-xs text-zinc-600 dark:text-zinc-400"
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
  <div class="mt-4 relative">
    <div
      class={{
        "h-[32px] overflow-hidden": !isExpanded,
        "pb-7": isExpanded,
        'transition-all duration-200"': true,
      }}
    >
      <!--
        Department abbreviations are the registration system's own vocabulary, so
        they are set in mono. Sixty filled pills read as a wall; unfilled mono
        text at one size lets the eye scan the column of letters instead.
      -->
      {#each getCurSemCategories() as category}
        <button
          class="u-data mr-2.5 mb-1.5 px-0.5 text-[0.75rem] font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-300 cursor-pointer transition-colors"
          onclick={() => {
            setSearchQuery(category);
          }}>{category}</button
        >
      {/each}
    </div>
    {#if getCurSemCategories().length > 5}
      <button
        class={{
          "absolute left-1/2 -translate-x-1/2 eyebrow px-2 py-1 cursor-pointer text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-300 bg-zinc-100 dark:bg-black": true,
          "translate-y-1/2 bottom-4": isExpanded,
          "bottom-0": !isExpanded,
        }}
        onclick={() => (isExpanded = !isExpanded)}
      >
        {isExpanded ? t("catalogue.showLess") : t("catalogue.showMore")}
        <span class="inline-block {isExpanded ? 'rotate-180' : ''}"><IconChevronDown /></span>
      </button>
    {/if}
  </div>
{/if}

<div
  class="mt-4 md:overflow-y-auto overflow-x-hidden flex flex-col md:min-h-0 shrink rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700"
  onmouseleave={() => setHoveredCourse("")}
  role="list"
  bind:this={courseCatalogue}
>
  {#each visibleCourseNames.slice(0, pageSize * page) as courseName, i}
    <Course
      {courseName}
      course={getCurSemesterData()[courseName]}
      currentSemester={getCurrentSemester()}
      selected={getSelectedCourseNames().includes(courseName)}
    />
  {/each}

  {#if hasMorePages}
    <div role="presentation" use:infiniteScroll={isLargeScreen ? courseCatalogue : null}>
      {#if isLoading}
        <p class="eyebrow px-4 py-3">{t("catalogue.loading")}</p>
      {/if}
    </div>
  {/if}
</div>

<div class="block md:hidden">
  <Footer />
</div>
