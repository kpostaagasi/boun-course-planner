<script>
  import SemesterSelect from "./SemesterSelect.svelte";
  import { t, getLang, setLang } from "./i18n.svelte";
</script>

<!--
  The one persistent dark band in the interface, and the only place the design
  states its own name. Everything else on the page is a surface holding data, so
  the bar stays a thin anchor rather than a masthead.
-->
<div
  data-testid="app-header"
  class="flex h-11 shrink-0 grow-0 items-center gap-3 bg-zinc-900 px-3 text-white dark:bg-black"
>
  <h1 class="text-[0.9375rem] font-semibold">{t("header.title")}</h1>

  <!--
    A two-state toggle, not two buttons: the current language is the filled one.
    Set in mono because it reads as a switch position, not as prose.
  -->
  <div class="u-data flex items-center overflow-hidden rounded border border-zinc-700">
    <button
      type="button"
      class="cursor-pointer px-1.5 py-0.5 text-[0.6875rem] font-semibold transition-colors {getLang() ===
      'en'
        ? 'bg-white text-zinc-900'
        : 'text-zinc-400 hover:text-white'}"
      onclick={() => setLang("en")}>EN</button
    >
    <button
      type="button"
      class="cursor-pointer px-1.5 py-0.5 text-[0.6875rem] font-semibold transition-colors {getLang() ===
      'tr'
        ? 'bg-white text-zinc-900'
        : 'text-zinc-400 hover:text-white'}"
      onclick={() => setLang("tr")}>TR</button
    >
  </div>

  <div class="ml-auto">
    <SemesterSelect />
  </div>
</div>
