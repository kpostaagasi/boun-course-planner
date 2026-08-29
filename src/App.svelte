<script lang="ts">
  import { onMount } from "svelte";
  import Header from "./lib/Header.svelte";
  import CourseCatalogue from "./lib/CourseCatalogue.svelte";
  import Timetable from "./lib/Timetable.svelte";
  import CourseList from "./lib/CourseList.svelte";
  import CommandPalette from "./lib/CommandPalette.svelte";
  import { loadPrereqs, loadCompleted, loadRoadmap, loadOfferings, initUrlSync } from "./lib/globalState.svelte";
  import GoogleAnalytics from "./lib/GoogleAnalytics.svelte";
  import { initLang } from "./lib/i18n.svelte";

  onMount(() => {
    initLang();
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
    // Fire-and-forget: localStorage restore, errors handled inside loadRoadmap
    loadRoadmap();
    return stopUrlSync;
  });
</script>

<main
  class="md:max-h-screen min-h-screen md:h-screen flex flex-col bg-zinc-100 dark:bg-black"
>
  <Header />

  <div class="flex flex-col md:flex-row grow md:overflow-hidden">
    <div
      class="w-full md:w-5/12 p-2 flex flex-col shrink-0 md:grow md:overflow-y-auto md:min-h-0"
    >
      <Timetable />
      <CourseList />
    </div>
    <div class="w-full md:w-7/12 p-2 flex flex-col grow h-full">
      <CourseCatalogue />
    </div>
  </div>
</main>
<CommandPalette />
<GoogleAnalytics />
