export type Theme = "light" | "dark";

/**
 * localStorage key for a toggle choice that differs from the system setting. Renamed from
 * "matr-theme" so choices saved under the old always-remember behaviour are ignored.
 */
export const THEME_STORAGE_KEY = "matr-theme-override";

/**
 * Runs in <head> before first paint, as a string because it must execute before React hydrates:
 * - theme: follow the OS setting unless the visitor toggled to the other theme (no flash).
 * - data-js: lets CSS hide [data-reveal] content until RevealObserver shows it. If the observer
 *   has not started within 3s (script failed to load), data-js is removed and everything shows.
 */
export const themeInitScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t}catch(e){}d.dataset.js="";setTimeout(function(){if(!d.hasAttribute("data-reveal-ready"))d.removeAttribute("data-js")},3000)})()`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function systemTheme(): Theme {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Applies a theme without saving it (used when following the system setting). */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/**
 * Applies a theme picked with the toggle. The system setting is the default, so a pick that
 * matches it clears any saved override; only a pick that differs from the system is remembered.
 */
export function chooseTheme(theme: Theme) {
  applyTheme(theme);
  try {
    if (theme === systemTheme()) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked (private mode): the choice still applies for this visit.
  }
}

/** Drops a saved override so the page follows the system setting again. */
export function clearThemeChoice() {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Nothing stored or storage blocked.
  }
}
