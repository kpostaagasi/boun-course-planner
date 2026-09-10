<script lang="ts">
  import { onMount } from "svelte";
  import Header from "./lib/Header.svelte";
  import TabBar from "./lib/TabBar.svelte";
  import CourseCatalogue from "./lib/CourseCatalogue.svelte";
  import Timetable from "./lib/Timetable.svelte";
  import CourseList from "./lib/CourseList.svelte";
  import GpaCalculator from "./lib/GpaCalculator.svelte";
  import CommandPalette from "./lib/CommandPalette.svelte";
  import {
    loadPrereqs,
    loadCompleted,
    loadOfferings,
    initUrlSync,
    pruneRetiredStorage,
    getActiveTab,
  } from "./lib/globalState.svelte";
  import GoogleAnalytics from "./lib/GoogleAnalytics.svelte";
  import { initLang } from "./lib/i18n.svelte";

  onMount(() => {
    initLang();
    // Drop localStorage a removed feature left behind; nothing reads it now.
    pruneRetiredStorage();
    // Back/Forward navigates between selection states; cleaned up on unmount.
    const stopUrlSync = initUrlSync();
    // Fire-and-forget: errors handled inside loadPrereqs
    loadPrereqs();
    // data/descriptions.json is ~244 KB gzipped and is deliberately NOT loaded
    // here — see ensureDescriptions(), called on demand by the course-card
    // description toggle and by the catalogue search's last-resort branch.
    // Fire-and-forget: errors handled inside loadOfferings
    loadOfferings();
    // Fire-and-forget: localStorage restore, errors handled inside loadCompleted
    loadCompleted();
    return stopUrlSync;
  });
</script>

<main
  class="flex min-h-screen flex-col bg-zinc-50 md:h-screen md:max-h-screen dark:bg-zinc-950"
>
  <Header />

  <div
    class="mx-auto flex w-full max-w-[110rem] grow flex-col gap-3 p-3 md:gap-4 md:min-h-0 md:overflow-hidden md:p-4"
  >
    <TabBar />

    <!--
      Both panels stay mounted only one at a time: the catalogue is the
      expensive tree in this app and re-rendering it on a tab switch is
      cheaper than keeping a hidden copy of it alive.
    -->
    {#if getActiveTab() === "planner"}
      <div
        id="panel-planner"
        role="tabpanel"
        aria-labelledby="tab-planner"
        class="flex grow flex-col gap-3 md:min-h-0 md:flex-row md:gap-4 md:overflow-hidden"
      >
        <!-- The plan: what you have chosen, and when it happens. -->
        <div
          class="flex w-full shrink-0 flex-col gap-3 md:w-5/12 md:min-h-0 md:grow md:overflow-y-auto md:pr-1"
        >
          <Timetable />
          <CourseList />
        </div>
        <!-- The choosing: search, filter, browse. -->
        <div class="flex h-full w-full grow flex-col md:w-7/12">
          <CourseCatalogue />
        </div>
      </div>
    {:else}
      <!-- The same plan, priced in grade points. -->
      <div
        id="panel-gpa"
        role="tabpanel"
        aria-labelledby="tab-gpa"
        class="grow md:min-h-0 md:overflow-y-auto"
      >
        <GpaCalculator />
      </div>
    {/if}
  </div>
</main>
<CommandPalette />
<GoogleAnalytics />
