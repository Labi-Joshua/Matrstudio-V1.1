export type Theme = "light" | "dark";

/**
 * Same key as the waitlist, so a visitor's light/dark choice carries over between the two on
 * matrstudio.com. The system setting is the default; only a choice that differs from it is saved.
 * (Duplicated from apps/waitlist for now; both move into packages/ui once the toggle is built.)
 */
export const THEME_STORAGE_KEY = "matr-theme-override";

/**
 * Runs in <head> before first paint, as a string because it must execute before React hydrates:
 * follow the OS setting unless the visitor chose the other theme (no flash of the wrong theme).
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`;
