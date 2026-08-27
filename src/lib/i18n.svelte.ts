import { dict, lookup, interpolate } from "./i18nDict.mjs";

export type Lang = "en" | "tr";

export { dict };

let lang = $state<Lang>("en");

export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem("lang", l);
  } catch {
    // localStorage unavailable (private mode etc.); keep in-memory only.
  }
}

export function getLang(): Lang {
  return lang;
}

export function initLang() {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("lang");
  } catch {
    // ignore
  }
  if (stored === "tr") {
    lang = "tr";
    return;
  }
  if (stored === "en") {
    lang = "en";
    return;
  }
  const navLang = typeof navigator !== "undefined" ? navigator.language : "en";
  lang = navLang.toLowerCase().startsWith("tr") ? "tr" : "en";
}

/**
 * Keys already reported in this session. `t()` is called from inside derived
 * values that re-run on every state change, so warning unconditionally would
 * flood the console with the same line hundreds of times and make the signal
 * useless.
 */
const warned = new Set<string>();

/**
 * Translate a key, optionally substituting `{name}` placeholders.
 *
 * A missing key renders as the key itself — visible but harmless — and warns
 * once in development. Silently returning the key with no signal is how the
 * previous implementation let gaps accumulate unnoticed.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const { text, missing } = lookup(key, lang);
  if (missing && import.meta.env.DEV && !warned.has(key)) {
    warned.add(key);
    console.warn(`[i18n] missing translation key: ${key}`);
  }
  return interpolate(text, vars);
}
