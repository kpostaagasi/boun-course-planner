<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentSemester } from "./globalState.svelte";
  import { t } from "./i18n.svelte";
  let meta: Record<string, string> | null = $state(null);

  const updatedAt = $derived.by(() => {
    if (!meta || !getCurrentSemester()) return undefined;
    // "2025/2026-1" -> "2025-2026-1" (meta.json keys match data filenames)
    const key = getCurrentSemester().replace("/", "-");
    return key in meta ? meta[key] : undefined;
  });

  onMount(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/meta.json`);
      if (res.ok) {
        meta = await res.json();
      }
    } catch {
      // Freshness info is optional; ignore fetch/parse failures.
    }
  });
</script>

<div class="py-3 text-center text-zinc-600 dark:text-zinc-400">
  <p class="text-sm">{t("footer.goodLuck")}</p>
  <small class="text-xs">
    {t("footer.disclaimerPre")}
    <a
      class="underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-blue-600 hover:decoration-blue-400 dark:decoration-zinc-600 dark:hover:text-blue-300"
      href="https://registration.boun.edu.tr"
      target="_blank"
      rel="noopener noreferrer"
      >{t("footer.registration")}</a
    >
    {t("footer.disclaimerPost")}
  </small>
  {#if updatedAt}
    <small class="u-data block text-[0.6875rem] text-zinc-600 dark:text-zinc-400"
      >{t("footer.dataUpdated")} {new Date(updatedAt).toLocaleString()}</small
    >
  {/if}
</div>
