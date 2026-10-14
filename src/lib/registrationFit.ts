export {
  REGISTRATION_FIT_KEY,
  departmentOptions,
  emptyProfile,
  isProfileEmpty,
  readStoredProfile,
  registrationFit,
  writeStoredProfile,
} from "./registrationFit.mjs";

/** The student's own registration facts: department, class year and surname. */
export type RegistrationProfile = {
  dept: string;
  classYear: string;
  surname: string;
};

/** One badge the fit check can show; the word is the meaning. */
export type FitBadge = "fit" | "surname" | "dept" | "class" | "no-data";

/**
 * Badges in display order — known fails first (surname, department,
 * class), `no-data` last when any dimension could not be decided —
 * plus the verbatim consent notes, which are information, not a
 * pass/fail.
 */
export type FitResult = {
  badges: FitBadge[];
  notes: string[];
};
