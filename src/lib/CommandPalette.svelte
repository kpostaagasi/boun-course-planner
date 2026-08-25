<script lang="ts">
  import { onMount } from "svelte";
  import {
    getCurSemesterData,
    addCourse,
    getSelectedCourseNames,
  } from "./globalState.svelte";
  import { t } from "./i18n.svelte";
  import { buildPaletteEntries, searchPalette } from "./paletteSearch";
  import type { PaletteEntry } from "./paletteSearch";

  let open = $state(false);
  let query = $state("");
  let activeIndex = $state(0);
  let input: HTMLInputElement | undefined = $state();
  let listEl: HTMLUListElement | undefined = $state();

  const results: PaletteEntry[] = $derived.by(() => {
    if (!open) return [];
    return searchPalette(buildPaletteEntries(getCurSemesterData()), query, 20);
  });

  function openPalette() {
    open = true;
    query = "";
    activeIndex = 0;
  }

  function close() {
    open = false;
  }

  function focusOnOpen(node: HTMLInputElement) {
    node.focus();
  }

  function pick(entry: PaletteEntry) {
    if (!getSelectedCourseNames().includes(entry.courseName)) {
      addCourse(entry.courseName);
    }
    close();
  }

  function onKeydown(e: KeyboardEvent) {
    // Global shortcut: Cmd/Ctrl+K opens, Esc closes while open.
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (open) close();
      else openPalette();
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  function onListKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, results.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = results[activeIndex];
      if (entry) pick(entry);
    }
  }

  $effect(() => {
    // Keep the highlighted result in view during keyboard navigation.
    if (listEl && open) {
      listEl.children[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  });

  onMount(() => {
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  });
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <div
    class="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-[10vh]"
    onclick={close}
    role="presentation"
  >
    <div
      class="w-full max-w-lg mx-4 bg-white dark:bg-zinc-800 shadow-xl"
      role="dialog"
      aria-modal="true"
      aria-label={t("palette.title")}
    >
      <input
        bind:this={input}
        bind:value={query}
        oninput={() => (activeIndex = 0)}
        onkeydown={onListKeydown}
        class="w-full p-3 text-lg bg-transparent border-b border-zinc-200 dark:border-zinc-600 focus:outline-none text-zinc-900 dark:text-white"
        placeholder={t("palette.placeholder")}
        use:focusOnOpen
      />
      {#if results.length > 0}
        <ul bind:this={listEl} class="max-h-80 overflow-y-auto" role="listbox">
          {#each results as entry, i (entry.courseName)}
            <li
              role="option"
              aria-selected={i === activeIndex}
              class="px-3 py-2 cursor-pointer {i === activeIndex
                ? 'bg-blue-100 dark:bg-blue-900'
                : ''}"
              onmouseenter={() => (activeIndex = i)}
              onclick={() => pick(entry)}
              onkeydown={(e) => onListKeydown(e)}
            >
              <span class="font-medium text-zinc-900 dark:text-white mr-2">{entry.code}</span>
              <span class="text-sm text-zinc-600 dark:text-zinc-300 mr-2 break-all">{entry.title}</span>
              <span class="text-xs text-zinc-400 dark:text-zinc-500">{entry.instructor}</span>
            </li>
          {/each}
        </ul>
      {:else if query.trim()}
        <div class="p-3 text-sm text-zinc-500 dark:text-zinc-400">{t("palette.noResults")}</div>
      {/if}
      <div class="px-3 py-1.5 text-xs text-zinc-400 dark:text-zinc-500 border-t border-zinc-200 dark:border-zinc-600">
        ↑↓ {t("palette.navigate")} · ⏎ {t("palette.add")} · Esc {t("palette.close")}
      </div>
    </div>
  </div>
{/if}

<!-- Floating hint button so mobile users can reach the palette too -->
<button
  type="button"
  class="fixed bottom-4 right-4 z-40 w-10 h-10 bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white shadow-lg cursor-pointer"
  title={t("palette.openTitle")}
  aria-label={t("palette.openTitle")}
  onclick={openPalette}
>⌘K</button>
