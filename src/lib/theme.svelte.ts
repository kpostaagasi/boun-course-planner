/**
 * Light / dark theme. The resolved value is a class on <html> (`dark`), so
 * Tailwind `dark:` utilities and the hand-written component CSS share one
 * switch. A stored preference wins; otherwise the OS preference is used and
 * is not written, so a student who never touched the control still follows
 * the system.
 *
 * The blocking snippet in index.html applies the same rule before first
 * paint. This module then owns the rune the header button reads, persistence
 * on toggle, and live OS changes while no preference is stored.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function systemDark(): boolean {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function readDomTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

let theme = $state<Theme>(readDomTheme());
let stopSystemListener: (() => void) | null = null;

function apply(next: Theme) {
  theme = next;
  const root = document.documentElement;
  root.classList.toggle("dark", next === "dark");
  root.style.colorScheme = next;
  root.dataset.theme = next;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", next === "dark" ? "#0f0f11" : "#fafafa");
  }
}

export function getTheme(): Theme {
  return theme;
}

export function initTheme(): () => void {
  apply(storedTheme() ?? (systemDark() ? "dark" : "light"));

  const media = matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (storedTheme() === null) {
      apply(media.matches ? "dark" : "light");
    }
  };
  media.addEventListener("change", onChange);
  stopSystemListener = () => media.removeEventListener("change", onChange);
  return () => {
    stopSystemListener?.();
    stopSystemListener = null;
  };
}

export function toggleTheme() {
  const next: Theme = theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // private mode: keep the in-memory choice for this tab
  }
  apply(next);
}
