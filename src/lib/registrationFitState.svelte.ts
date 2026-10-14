/**
 * The student's own registration profile: department, class year and
 * surname, read by the "Bana uygun mu?" check. localStorage only —
 * there is no account to send it to, and the copy next to the
 * fields says so. Same storage style as theme.svelte.ts: every
 * access is wrapped, so a throwing storage degrades to the
 * in-memory value instead of breaking the tab.
 */
import {
  REGISTRATION_FIT_KEY,
  emptyProfile,
  readStoredProfile,
  writeStoredProfile,
  type RegistrationProfile,
} from "./registrationFit";

let profile = $state<RegistrationProfile>(emptyProfile());
let loaded = false;

/** The profile the fit check compares the quota snapshot against. */
export function getRegistrationProfile(): RegistrationProfile {
  return profile;
}

/**
 * Restore the profile from localStorage, once. Idempotent; the
 * try/catch lives in `readStoredProfile`, so a corrupt or refused
 * read leaves the empty profile.
 */
export function loadRegistrationProfile(): void {
  if (loaded) return;
  loaded = true;
  try {
    profile = readStoredProfile(localStorage);
  } catch {
    profile = emptyProfile();
  }
}

/**
 * Update part of the profile and persist it. A failed write (private
 * mode) still updates this tab's copy — the fit check keeps working
 * until the tab closes.
 */
export function setRegistrationProfile(
  partial: Partial<RegistrationProfile>
): void {
  profile = { ...profile, ...partial };
  try {
    writeStoredProfile(localStorage, profile);
  } catch {
    // private mode: this tab still has the updated profile
  }
}

/** Reset to the empty profile and drop the stored copy. */
export function clearRegistrationProfile(): void {
  profile = emptyProfile();
  try {
    localStorage.removeItem(REGISTRATION_FIT_KEY);
  } catch {
    // private mode: the in-memory reset still applies
  }
}
