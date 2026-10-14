<script lang="ts">
  import {
    getQuotaScrapedAt,
    getQuotaSections,
    loadQuota,
  } from "./globalState.svelte";
  import {
    clearRegistrationProfile,
    getRegistrationProfile,
    loadRegistrationProfile,
    setRegistrationProfile,
  } from "./registrationFitState.svelte";
  import { departmentOptions } from "./registrationFit";
  import { getLang, t } from "./i18n.svelte";

  // Quota is the panel's only data source — the department list
  // comes from it — and `loadQuota` dedupes to a single request for
  // the whole app, so this costs nothing extra. Same for the
  // profile restore: `loadRegistrationProfile` runs once.
  loadQuota();
  loadRegistrationProfile();

  const profile = $derived(getRegistrationProfile());
  /** Only departments the quota file names; never a hardcoded list. */
  const depts = $derived(departmentOptions(getQuotaSections()));
  const scrapedAt = $derived(getQuotaScrapedAt());

  /**
   * The snapshot clock, shown verbatim like the course card's: a
   * relative age computed once at render would silently freeze in a
   * long-lived tab, and an enrolment count that looks fresher than
   * it is defeats the point.
   */
  const quotaClock = $derived.by(() => {
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

  function onDept(value: string) {
    setRegistrationProfile({ dept: value });
  }
  function onClassYear(value: string) {
    setRegistrationProfile({ classYear: value });
  }
  function onSurname(value: string) {
    setRegistrationProfile({ surname: value });
  }
</script>

<div class="card px-4 py-3" data-testid="registration-fit-panel">
  <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
    <h2 class="text-[0.9375rem] font-semibold">{t("fit.title")}</h2>
    {#if scrapedAt}
      <!--
        The same stamp the course cards carry: when the snapshot
        was taken, and how old that makes every number in it.
        Nothing is shown when the file carries no timestamp.
      -->
      <span
        class="text-xs text-zinc-500 dark:text-zinc-400"
        title={t("quota.scrapedTitle", { time: quotaClock })}
      >
        {t("quota.asOf", { time: quotaClock })}
      </span>
    {/if}
  </div>
  <div class="mt-2 grid gap-3 sm:grid-cols-3">
    <div class="flex flex-col gap-1.5">
      <label class="eyebrow" for="fit-dept">{t("fit.dept")}</label>
      <select
        id="fit-dept"
        class="u-data w-full cursor-pointer rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-blue-400"
        value={profile.dept}
        oninput={(e) =>
          onDept((e.currentTarget as HTMLSelectElement).value)}
      >
        <option value="">{t("fit.deptPlaceholder")}</option>
        {#each depts as dept}
          <option value={dept}>{dept}</option>
        {/each}
      </select>
      {#if depts.length === 0}
        <span class="text-xs text-zinc-500 dark:text-zinc-400"
          >{t("fit.noDepts")}</span
        >
      {/if}
    </div>
    <div class="flex flex-col gap-1.5">
      <label class="eyebrow" for="fit-class-year">{t("fit.classYear")}</label>
      <input
        id="fit-class-year"
        class="u-data w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-blue-400"
        value={profile.classYear}
        placeholder={t("fit.classPlaceholder")}
        oninput={(e) =>
          onClassYear((e.currentTarget as HTMLInputElement).value)}
      />
    </div>
    <div class="flex flex-col gap-1.5">
      <label class="eyebrow" for="fit-surname">{t("fit.surname")}</label>
      <input
        id="fit-surname"
        class="u-data w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-blue-400"
        value={profile.surname}
        placeholder={t("fit.surnamePlaceholder")}
        oninput={(e) =>
          onSurname((e.currentTarget as HTMLInputElement).value)}
      />
    </div>
  </div>
  <div class="mt-2 flex flex-wrap items-center gap-2">
    <button type="button" class="btn-quiet" onclick={clearRegistrationProfile}>
      {t("fit.clear")}
    </button>
  </div>
  <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
    {t("fit.localOnly")}
  </p>
  <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
    {t("fit.authority")}
  </p>
</div>
