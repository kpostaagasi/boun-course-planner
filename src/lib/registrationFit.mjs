/**
 * Pure "Bana uygun mu?" logic: given a stored quota section and the
 * student's own registration profile (department, class year, surname),
 * decide which of the section's registration restrictions the student
 * falls outside — or whether the snapshot cannot say.
 *
 * The registrar's quota page states three independent kinds of
 * restriction — departmental, class-year and surname — and the
 * registration system is the only authority that can answer "may I take
 * this". What this module computes is therefore always a reading of a
 * snapshot: "fits" means "nothing in this snapshot rules you out",
 * never "you are registered".
 *
 * The hard rules this module exists to enforce:
 *
 *   no profile   the student has not said who they are yet, so the
 *                caller renders nothing at all — an empty result is
 *                not a verdict
 *   no record    a section absent from quota.json is "no data", never
 *                "fits" and never an outside-badge
 *   broken data  a malformed surname band means "cannot tell", never a
 *                guess: a band that says K–A must not be read as A–K,
 *                and one broken band must not be averaged away by the
 *                valid ones
 *
 * Profile data never leaves the device: `readStoredProfile` /
 * `writeStoredProfile` are the only I/O, every storage call is wrapped,
 * and a throwing storage degrades to an empty profile / a `false`
 * write instead of an exception.
 */

/**
 * The Turkish alphabet in its own order, compared by index — never by
 * code point. Q, W and X are not in it, and I comes before İ.
 */
const TURKISH_ALPHABET = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ";

/** A row's `dept` of "ALL" means "no restriction", not a department. */
const UNRESTRICTED = /^all$/i;

/** The registration rule the registrar spells out in a Quota cell. */
const CONSENT_NOTE = /consent\s+of\s+instructor/i;

/**
 * @typedef {object} QuotaRowInput
 * @property {string} [dept]
 * @property {string} [status]
 * @property {number} [quota]
 * @property {number} [current]
 * @property {string} [note]
 * @property {string} [scope] `"class"` / `"semester"` when `dept` holds a class
 *   or semester number rather than a department.
 */

/**
 * One surname-restriction band. The producer has never emitted this
 * block (see tools/lib/parse-quota.mjs), so every field is validated
 * before use and a band that fails validation is "unknown", never a
 * guess.
 * @typedef {object} SurnameBandInput
 * @property {string} [from]
 * @property {string} [to]
 */

/**
 * One stored section, as `public/data/quota.json` keeps it. `surname` is
 * `unknown[]` on purpose: the quota type stores bands as `unknown[]`, and
 * every band is validated before it is trusted.
 * @typedef {object} FitSectionInput
 * @property {number | null} [cap]
 * @property {QuotaRowInput[]} [rows]
 * @property {unknown[]} [surname]
 * @property {string} [note]
 */

/**
 * The student's own registration facts, typed in once and stored only
 * on this device.
 * @typedef {object} RegistrationProfileInput
 * @property {string} [dept]
 * @property {string} [classYear]
 * @property {string} [surname]
 */

/**
 * @typedef {object} FitResult
 * @property {("fit"|"surname"|"dept"|"class"|"no-data")[]} badges fail badges
 *   first (surname, department, class), then `"no-data"` when any
 *   dimension could not be decided; exactly `["fit"]` when nothing
 *   rules the student out.
 * @property {string[]} notes verbatim consent-of-instructor notes, in
 *   file order — information, never a pass/fail.
 */

/**
 * @typedef {object} StoredProfile
 * @property {string} dept
 * @property {string} classYear
 * @property {string} surname
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function textOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Case-fold a department name for comparison and for the picker.
 *
 * Turkish `toLocaleLowerCase("tr-TR")` turns ASCII `I` into `ı`, so
 * `"ECONOMICS"` and `"economics"` would not compare equal. Department
 * names in the quota file are English. Fold the i-family to `i` first,
 * then Turkish-lowercase the rest, so trim + case-insensitive match
 * holds for both `"ECONOMICS"` and a name that actually uses `İ`.
 * @param {unknown} value
 * @returns {string}
 */
function deptKey(value) {
  return textOrEmpty(value)
    .replaceAll("İ", "i")
    .replaceAll("I", "i")
    .replaceAll("ı", "i")
    .toLocaleLowerCase("tr-TR");
}

/** The empty profile: nothing typed in, nothing to compare against.
 * @returns {StoredProfile}
 */
export function emptyProfile() {
  return { dept: "", classYear: "", surname: "" };
}

/**
 * True only when every field is blank after trim. A missing profile is
 * empty — the student has not said who they are, which is not a verdict
 * about any section.
 * @param {RegistrationProfileInput | null | undefined} profile
 * @returns {boolean}
 */
export function isProfileEmpty(profile) {
  return (
    textOrEmpty(profile?.dept) === "" &&
    textOrEmpty(profile?.classYear) === "" &&
    textOrEmpty(profile?.surname) === ""
  );
}

/**
 * Every department the quota file names, for the profile panel's
 * department picker.
 *
 * Class and semester rows carry numbers, not departments; ALL is the
 * absence of a restriction, not a department; and the picker must never
 * offer a name the file does not contain. Deduplication is by Turkish
 * lower-case (so "ECONOMICS" and "economics" are one department, first
 * spelling kept) and the sort is Turkish, so "Ç" orders between "C"
 * and "D".
 *
 * @param {Record<string, FitSectionInput> | null | undefined} sections
 *   the quota.json `sections` map
 * @returns {string[]} department names, Turkish-sorted, first spelling kept
 */
export function departmentOptions(sections) {
  /** @type {string[]} */
  const options = [];
  /** @type {Set<string>} */
  const seen = new Set();
  if (!sections || typeof sections !== "object") return options;
  for (const section of Object.values(sections)) {
    const rows = Array.isArray(section?.rows) ? section.rows : [];
    for (const row of rows) {
      // A scoped row ("Class 4", "Semester 1") holds a class or
      // semester number in `dept`, not a department.
      if (textOrEmpty(row?.scope) !== "") continue;
      const dept = textOrEmpty(row?.dept);
      if (dept === "" || UNRESTRICTED.test(dept)) continue;
      const key = deptKey(dept);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(dept);
    }
  }
  return options.sort((a, b) => a.localeCompare(b, "tr"));
}

/**
 * The student's surname initial: the first Unicode code point of the
 * trimmed surname, Turkish-uppercased ("i" → "İ", "ı" → "I"). Null
 * when there is no first code point to read.
 * @param {unknown} surname
 * @returns {string | null}
 */
function surnameInitial(surname) {
  if (typeof surname !== "string") return null;
  const trimmed = surname.trim();
  if (trimmed === "") return null;
  // codePointAt reads the first code point, so a supplementary-plane
  // initial is not split into surrogates; such a character upper-cases
  // to itself, is not in the alphabet, and is the "unknown" case.
  const first = trimmed.codePointAt(0);
  return first === undefined
    ? null
    : String.fromCodePoint(first).toLocaleUpperCase("tr-TR");
}

/**
 * A surname-band endpoint as an index into the Turkish alphabet, or null
 * when it is not exactly one alphabet letter after Turkish
 * upper-casing. Index comparison, never code points: "Q" is not in the
 * alphabet and "AA" is not one letter.
 * @param {unknown} value
 * @returns {number | null}
 */
function alphabetIndex(value) {
  if (typeof value !== "string") return null;
  const letter = value.trim().toLocaleUpperCase("tr-TR");
  if (letter.length !== 1) return null;
  const index = TURKISH_ALPHABET.indexOf(letter);
  return index === -1 ? null : index;
}

/**
 * The surname dimension. No band recorded is not a restriction; a band
 * that cannot be parsed makes the whole dimension unknown rather than a
 * guess from the bands that did parse.
 * @param {FitSectionInput | null | undefined} section
 * @param {RegistrationProfileInput | null | undefined} profile
 * @returns {"pass" | "fail" | "unknown"}
 */
function surnameFit(section, profile) {
  const bands = Array.isArray(section?.surname) ? section.surname : [];
  if (bands.length === 0) return "pass";

  const initial = surnameInitial(profile?.surname);
  // An initial that is not in the alphabet cannot be placed in a range.
  if (initial === null || TURKISH_ALPHABET.indexOf(initial) === -1) {
    return "unknown";
  }
  const letter = TURKISH_ALPHABET.indexOf(initial);

  let broken = false;
  let inside = false;
  for (const band of bands) {
    const record =
      band && typeof band === "object"
        ? /** @type {{ from?: unknown, to?: unknown }} */ (band)
        : null;
    const from = alphabetIndex(record?.from);
    const to = alphabetIndex(record?.to);
    // A broken band is unknown, never swapped and never skipped: the
    // other bands cannot carry the verdict this one was meant to hold.
    if (from === null || to === null || from > to) {
      broken = true;
      continue;
    }
    if (letter >= from && letter <= to) inside = true;
  }
  if (broken) return "unknown";
  return inside ? "pass" : "fail";
}

/**
 * Class-year equality: trimmed, Turkish case-insensitive text, or the
 * same number written with different zero padding ("01" is year 1).
 * Words are never fuzzy-matched: "first" does not match "1".
 * @param {unknown} rowDept
 * @param {string} year
 * @returns {boolean}
 */
function sameYear(rowDept, year) {
  const rowYear = textOrEmpty(rowDept);
  if (rowYear.toLocaleLowerCase("tr-TR") === year.toLocaleLowerCase("tr-TR")) {
    return true;
  }
  if (/^\d+$/.test(rowYear) && /^\d+$/.test(year)) {
    return Number(rowYear) === Number(year);
  }
  return false;
}

/**
 * The class-year dimension. Only a class table is a class check — the
 * semester table the registrar added mid-term is a breakdown of who may
 * take the section, not a class-year restriction (see quotaInfo.mjs).
 * @param {FitSectionInput | null | undefined} section
 * @param {RegistrationProfileInput | null | undefined} profile
 * @returns {"pass" | "fail" | "unknown"}
 */
function classFit(section, profile) {
  const rows = Array.isArray(section?.rows) ? section.rows : [];
  const classRows = rows.filter(
    (row) => textOrEmpty(row?.scope).toLowerCase() === "class",
  );
  if (classRows.length === 0) return "pass";

  const year = textOrEmpty(profile?.classYear);
  // The section names allowed years and the student has not said which
  // one they are: not a fail, just not decidable.
  if (year === "") return "unknown";

  const usable = classRows.filter((row) => textOrEmpty(row?.dept) !== "");
  if (usable.length === 0) return "unknown";

  return usable.some((row) => sameYear(row?.dept, year)) ? "pass" : "fail";
}

/**
 * The department dimension. Departmental rows are the unscoped ones;
 * class and semester rows state who may take the section, not which
 * departments do. A note — "Consent Of Instructor" included — is the
 * rule's wording, never a barrier.
 * @param {FitSectionInput | null | undefined} section
 * @param {RegistrationProfileInput | null | undefined} profile
 * @returns {"pass" | "fail" | "unknown"}
 */
function departmentFit(section, profile) {
  const rows = Array.isArray(section?.rows) ? section.rows : [];
  const departmental = rows.filter((row) => textOrEmpty(row?.scope) === "");

  /** @type {string[]} */
  const named = [];
  for (const row of departmental) {
    const dept = textOrEmpty(row?.dept);
    if (dept !== "" && !UNRESTRICTED.test(dept)) named.push(dept);
  }
  // No rows, or only ALL: the section is not department-restricted.
  if (named.length === 0) return "pass";

  const studentDept = textOrEmpty(profile?.dept);
  // A named restriction with nothing to compare against is unknown, not
  // a fail: the student may well be in one of the named departments.
  if (studentDept === "") return "unknown";

  const studentKey = deptKey(studentDept);
  // ALL does not satisfy the match: a named restriction is only met by
  // the name itself.
  return named.some((dept) => deptKey(dept) === studentKey) ? "pass" : "fail";
}

/**
 * Verbatim "Consent Of Instructor" notes from the departmental rows and
 * the section-level note, in file order. A consent note is information
 * about how to register, not a pass/fail, so it is surfaced as text —
 * and only this wording is collected, never "Unlimited" or any other
 * note.
 * @param {FitSectionInput | null | undefined} section
 * @returns {string[]}
 */
function consentNotes(section) {
  /** @type {string[]} */
  const candidates = [];
  const rows = Array.isArray(section?.rows) ? section.rows : [];
  for (const row of rows) {
    if (textOrEmpty(row?.scope) !== "") continue;
    if (typeof row?.note === "string" && row.note !== "") {
      candidates.push(row.note);
    }
  }
  if (typeof section?.note === "string" && section.note !== "") {
    candidates.push(section.note);
  }

  /** @type {string[]} */
  const notes = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const note of candidates) {
    if (!CONSENT_NOTE.test(note) || seen.has(note)) continue;
    seen.add(note);
    notes.push(note);
  }
  return notes;
}

/**
 * Does this section fit this student?
 *
 * Three independent dimensions — surname, department, class year — each
 * "pass", "fail" or "unknown". Fails are reported in the order they
 * are checked (surname, department, class); any "unknown" adds
 * "no-data" and suppresses "fit", but never removes a known fail.
 * @param {FitSectionInput | null | undefined} section
 * @param {RegistrationProfileInput | null | undefined} profile
 * @returns {FitResult}
 */
export function registrationFit(section, profile) {
  // No profile is not a verdict: with nothing to compare against, the
  // caller renders nothing rather than an empty-sounding badge row.
  if (isProfileEmpty(profile)) {
    return { badges: [], notes: [] };
  }
  // A section the quota snapshot does not carry cannot be fitted — and
  // must not be fitted: "no data", never "fits" and never an
  // outside-badge.
  if (section === null || section === undefined) {
    return { badges: ["no-data"], notes: [] };
  }

  const surname = surnameFit(section, profile);
  const dept = departmentFit(section, profile);
  const klass = classFit(section, profile);

  /** @type {("fit"|"surname"|"dept"|"class"|"no-data")[]} */
  const badges = [];
  if (surname === "fail") badges.push("surname");
  if (dept === "fail") badges.push("dept");
  if (klass === "fail") badges.push("class");
  const unknown =
    surname === "unknown" || dept === "unknown" || klass === "unknown";
  if (badges.length === 0 && !unknown) {
    badges.push("fit");
  }
  // A known fail survives an unknown dimension: it is a fact about the
  // snapshot, not a guess, so it stays and "no-data" is added, not
  // swapped in.
  if (unknown) badges.push("no-data");

  return { badges, notes: consentNotes(section) };
}

/** localStorage key the profile is stored under. */
export const REGISTRATION_FIT_KEY = "registrationFit";

/**
 * The stored profile, or the empty profile when there is nothing
 * stored, nothing parseable, or the storage itself refuses access.
 * @param {Pick<Storage, "getItem"> | null | undefined} storage
 * @returns {StoredProfile}
 */
export function readStoredProfile(storage) {
  try {
    const raw = storage?.getItem(REGISTRATION_FIT_KEY);
    if (typeof raw !== "string" || raw.trim() === "") return emptyProfile();
    const parsed = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return emptyProfile();
    }
    return {
      dept: typeof parsed.dept === "string" ? parsed.dept : "",
      classYear:
        typeof parsed.classYear === "string" ? parsed.classYear : "",
      surname: typeof parsed.surname === "string" ? parsed.surname : "",
    };
  } catch {
    // Corrupt JSON or a throwing storage: an empty profile, never an
    // exception — the panel simply looks like it was never filled in.
    return emptyProfile();
  }
}

/**
 * Persist the profile. Exactly the three fields are written, and a
 * storage that refuses the write is a `false`, never an exception: the
 * in-memory profile still works for this tab.
 * @param {Pick<Storage, "setItem"> | null | undefined} storage
 * @param {RegistrationProfileInput | null | undefined} profile
 * @returns {boolean} true when the profile was written
 */
export function writeStoredProfile(storage, profile) {
  try {
    storage?.setItem(
      REGISTRATION_FIT_KEY,
      JSON.stringify({
        dept: typeof profile?.dept === "string" ? profile.dept : "",
        classYear:
          typeof profile?.classYear === "string" ? profile.classYear : "",
        surname: typeof profile?.surname === "string" ? profile.surname : "",
      }),
    );
    return true;
  } catch {
    // Private mode or a throwing storage: nothing was persisted.
    return false;
  }
}
