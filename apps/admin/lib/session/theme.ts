export type Theme = "light" | "dark";
export type ThemeChoice = Theme | "system";

/** Same key as the learner app and the waitlist, so the choice carries across matrstudio sites. */
export const THEME_STORAGE_KEY = "matr-theme-override";
export const THEME_EVENT = "matr:theme-change";

/**
 * Runs before first paint, as a string because it must execute before React hydrates: follow the
 * OS setting unless the admin chose the other theme (no flash of the wrong theme). Each page's
 * inline script is hashed into its CSP at build time (scripts/csp-hashes.mjs).
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`;

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/** Applies and stores a choice ("system" clears the override and follows the OS). */
export function applyThemeChoice(choice: ThemeChoice): void {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = choice === "system" ? (dark ? "dark" : "light") : choice;
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage can be blocked; the choice still applies for this visit.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}
