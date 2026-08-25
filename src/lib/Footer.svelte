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

<div class="text-center text-zinc-500 py-3">
  <p class="text-sm">{t("footer.goodLuck")}</p>
  <small class="text-xs">
    This website has no affiliation with Boğaziçi University. Please check
    <a
      class="underline hover:text-blue-500"
      href="https://registration.boun.edu.tr"
      target="_blank"
      rel="noopener noreferrer"
      >{t("footer.registration")}</a
    > for most up-to-date schedule. The schedule information presented in this page
    may sometimes lag behind the registration website.
  </small>
  {#if updatedAt}
    <small class="block text-xs">{t("footer.dataUpdated")} {new Date(updatedAt).toLocaleString()}</small>
  {/if}
</div>
