<script>
  import SemesterSelect from "./SemesterSelect.svelte";
  import { t, getLang, setLang } from "./i18n.svelte";

  /** The two UI languages, in toggle order. @type {("en" | "tr")[]} */
  const LANGS = ["en", "tr"];
</script>

<!--
  The top bar states the app's name, the term being browsed and the language,
  and then stops. It is a single hairline over the page — no rules, no tint, no
  second row — because everything a student came here to do happens below it.
-->
<header
  data-testid="app-header"
  class="shrink-0 grow-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
>
  <div class="mx-auto flex min-h-14 max-w-[110rem] items-center gap-2 px-3 sm:gap-3 sm:px-5">
    <h1
      class="min-w-0 truncate text-[0.9375rem] font-semibold text-zinc-900 sm:text-base dark:text-zinc-50"
    >
      {t("header.title")}
    </h1>

    <div class="ml-auto flex shrink-0 items-center gap-2">
      <SemesterSelect />

      <!--
        A segmented control, not two buttons: the current language is the
        raised position. `aria-pressed` carries the state to assistive tech
        and is what the e2e helper waits on, so the styling can change freely.
      -->
      <div
        class="flex items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800"
      >
        {#each LANGS as code (code)}
          <button
            type="button"
            aria-pressed={getLang() === code}
            class="cursor-pointer rounded-md px-1.5 py-1 text-xs font-semibold transition-colors sm:px-2 {getLang() ===
            code
              ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}"
            onclick={() => setLang(code)}>{code.toUpperCase()}</button
          >
        {/each}
      </div>
    </div>
  </div>
</header>
