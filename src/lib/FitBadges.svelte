<script lang="ts">
  import { registrationFit, type FitBadge } from "./registrationFit";
  import { getRegistrationProfile, loadRegistrationProfile } from "./registrationFitState.svelte";
  import { getQuotaScrapedAt } from "./globalState.svelte";
  import { getLang, t } from "./i18n.svelte";
  import type { QuotaSection } from "./quotaInfo";

  interface Props {
    section: QuotaSection | null;
    showClock?: boolean;
  }

  let { section, showClock = false }: Props = $props();

  loadRegistrationProfile();

  const result = $derived(registrationFit(section, getRegistrationProfile()));

  const quotaClock = $derived.by(() => {
    if (!showClock) return "";
    const scrapedAt = getQuotaScrapedAt();
    if (!scrapedAt) return "";
    const at = new Date(scrapedAt);
    if (Number.isNaN(at.getTime())) return "";
    return at.toLocaleString(getLang() === "tr" ? "tr-TR" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  });

  const BADGE_LABEL: Record<FitBadge, string> = {
    fit: "fit.badge.fit",
    surname: "fit.badge.surname",
    dept: "fit.badge.dept",
    class: "fit.badge.class",
    "no-data": "fit.badge.noData",
  };

  const BADGE_CLASS: Record<FitBadge, string> = {
    fit: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300",
    surname: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    dept: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    class: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    "no-data": "bg-zinc-100 text-zinc-600 italic dark:bg-zinc-800 dark:text-zinc-300",
  };
</script>

{#if result.badges.length > 0}
  <span
    class="inline-flex flex-wrap items-center gap-1"
    data-testid="fit-badges"
    title={t("fit.authority")}
  >
    {#each result.badges as badge (badge)}
      <span
        class="inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-medium {BADGE_CLASS[badge]}"
        data-fit={badge}
      >{t(BADGE_LABEL[badge])}</span>
    {/each}
    {#if result.notes.length > 0}
      <span class="text-[0.6875rem] text-zinc-600 dark:text-zinc-400">{result.notes.join(" · ")}</span>
    {/if}
    {#if quotaClock}
      <span
        class="text-xs text-zinc-500 dark:text-zinc-400"
        title={t("quota.scrapedTitle", { time: quotaClock })}
      >{t("quota.asOf", { time: quotaClock })}</span>
    {/if}
  </span>
{/if}
