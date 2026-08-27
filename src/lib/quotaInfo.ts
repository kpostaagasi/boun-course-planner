export { quotaDisplay, quotaAge } from "./quotaInfo.mjs";

/** One stored departmental- or class-quota row of `public/data/quota.json`. */
export type QuotaRow = {
  dept?: string;
  status?: string;
  quota?: number;
  current?: number;
  /** Verbatim non-numeric Quota cell, e.g. `"Consent Of Instructor"`. */
  note?: string;
};

/**
 * One stored section. Every field is optional: the producer omits `cap` when
 * the page states no capacity and omits `rows` / `surname` when they are empty.
 */
export type QuotaSection = {
  cap?: number | null;
  rows?: QuotaRow[];
  surname?: unknown[];
  note?: string;
};

/**
 * `kind` is the honesty discriminator. `unknown` means we have no usable
 * record — the card must not render a number for it. `note-only` means rows
 * exist but none allocates seats, so the verbatim `notes` are the actual
 * registration rule.
 */
export type QuotaDisplay = {
  kind: "unknown" | "capacity-only" | "enrolment" | "note-only";
  cap: number | null;
  quota: number | null;
  current: number | null;
  free: number | null;
  full: boolean;
  overEnrolled: boolean;
  depts: string[];
  restricted: boolean;
  statuses: string[];
  notes: string[];
  surnameCount: number;
  surnameRestricted: boolean;
};

export type QuotaAge = {
  unit: "minute" | "hour" | "day";
  value: number;
  minutes: number;
};
