<script>
  import SemesterSelect from "./SemesterSelect.svelte";
  import { t, getLang, setLang } from "./i18n.svelte";
</script>

<!--
  The masthead: the only place the design states its own name, set like a
  newspaper letterhead — ink on paper, closed by an Oxford rule (thick over
  thin). The semester selector sits at the far end as the edition number.
-->
<div data-testid="app-header" class="shrink-0 grow-0 bg-white dark:bg-black">
  <div
    class="flex h-11 items-center gap-3 border-b-2 border-zinc-900 px-3 text-zinc-900 dark:border-zinc-200 dark:text-zinc-100"
  >
    <h1 class="text-[0.9375rem] font-extrabold tracking-tight">
      {t("header.title")}
    </h1>

    <!--
      A two-state toggle, not two buttons: the current language is the filled
      one. Set in mono because it reads as a switch position, not as prose.
    -->
    <div
      class="u-data flex items-center overflow-hidden rounded-sm border border-zinc-300 dark:border-zinc-600"
    >
      <button
        type="button"
        class="cursor-pointer px-1.5 py-0.5 text-[0.6875rem] font-semibold transition-colors {getLang() ===
        'en'
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}"
        onclick={() => setLang("en")}>EN</button
      >
      <button
        type="button"
        class="cursor-pointer px-1.5 py-0.5 text-[0.6875rem] font-semibold transition-colors {getLang() ===
        'tr'
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}"
        onclick={() => setLang("tr")}>TR</button
      >
    </div>

    <div class="ml-auto">
      <SemesterSelect />
    </div>
  </div>
  <!-- The thin half of the Oxford rule: 2px of paper, then a hairline. -->
  <div
    class="h-[3px] border-b border-zinc-900 dark:border-zinc-200"
    aria-hidden="true"
  ></div>
</div>
