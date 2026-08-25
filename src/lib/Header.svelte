<script>
  import SemesterSelect from "./SemesterSelect.svelte";
  import { t, getLang, setLang } from "./i18n.svelte";
</script>

<div
  class="shrink-0 grow-0 bg-black dark:bg-zinc-800 text-white h-10 flex items-center"
>
  <div class="mx-2 my-1"><h1>{t("header.title")}</h1></div>
  <div class="mx-2 my-1 text-xs flex items-center gap-1">
    <button
      type="button"
      class="cursor-pointer px-1 rounded {getLang() === 'en'
        ? 'bg-white text-black'
        : 'text-zinc-300 hover:text-white'}"
      onclick={() => setLang("en")}>EN</button
    >
    <span class="text-zinc-500">|</span>
    <button
      type="button"
      class="cursor-pointer px-1 rounded {getLang() === 'tr'
        ? 'bg-white text-black'
        : 'text-zinc-300 hover:text-white'}"
      onclick={() => setLang("tr")}>TR</button
    >
  </div>
  <div class="ml-auto mr-2 my-1">
    <SemesterSelect />
  </div>
</div>
