<script lang="ts">
  import { getActiveTab, setActiveTab, type Tab } from "./globalState.svelte";
  import { t } from "./i18n.svelte";

  /** The two views, in tab order. */
  const TABS: Tab[] = ["planner", "gpa"];

  let buttons = $state<HTMLButtonElement[]>([]);

  /**
   * Arrow keys move between tabs and select as they go (automatic activation,
   * which is the right pattern when switching is instant and cheap — nothing
   * here fetches). Only the selected tab is in the page's tab order, so Tab
   * moves out of the strip and into the panel rather than through both tabs.
   */
  function onKeydown(event: KeyboardEvent, index: number) {
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === -1) return;
    event.preventDefault();
    setActiveTab(TABS[next]);
    buttons[next]?.focus();
  }
</script>

<!--
  Two views of one plan, so a segmented control rather than a nav bar: it is
  the same shape the language toggle already uses in the header, one step up
  in size because this one switches the whole page.
-->
<div
  role="tablist"
  aria-label={t("tab.switcher")}
  class="flex shrink-0 items-center gap-0.5 self-start rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800"
>
  {#each TABS as tab, index (tab)}
    <button
      bind:this={buttons[index]}
      type="button"
      role="tab"
      id="tab-{tab}"
      data-testid="tab-{tab}"
      aria-selected={getActiveTab() === tab}
      aria-controls="panel-{tab}"
      tabindex={getActiveTab() === tab ? 0 : -1}
      class="cursor-pointer rounded-md px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors {getActiveTab() ===
      tab
        ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white'
        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}"
      onclick={() => setActiveTab(tab)}
      onkeydown={(event) => onKeydown(event, index)}>{t(`tab.${tab}`)}</button
    >
  {/each}
</div>
