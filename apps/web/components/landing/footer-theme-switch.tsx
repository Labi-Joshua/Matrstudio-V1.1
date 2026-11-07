"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "../../lib/theme";

/**
 * Figma Theme Switch 742:42768 (Dark / Light / System). "System" clears the stored override and
 * follows the OS setting, matching lib/theme.ts. Before hydration the active pill follows the
 * rendered theme through the `dark:` variant, so there is no flash of the wrong state.
 */
type Choice = "dark" | "light" | "system";
const OPTIONS: { value: Choice; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

const prefersDark = () => matchMedia("(prefers-color-scheme: dark)").matches;

export function FooterThemeSwitch() {
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      setChoice(stored === "light" || stored === "dark" ? stored : "system");
    } catch {
      setChoice("system");
    }
  }, []);

  function select(next: Choice) {
    setChoice(next);
    const theme = next === "system" ? (prefersDark() ? "dark" : "light") : next;
    document.documentElement.dataset.theme = theme;
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the choice still applies for this visit.
    }
  }

  return (
    <fieldset className="m-0 flex min-w-0 border-0 h-[42px] w-[242px] shrink-0 items-start gap-0.5 rounded-xl bg-bg-fill2 p-1">
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map(({ value, label }) => {
        // Before hydration `choice` is null: Dark follows the dark theme, Light follows light.
        const pre =
          choice === null
            ? value === "dark"
              ? "hidden-light"
              : value === "light"
                ? "hidden-dark"
                : "none"
            : "none";
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => select(value)}
            className={`flex h-full min-w-0 flex-1 items-center justify-center rounded-[9px] py-[7px] text-[14px] leading-5 tracking-[-0.14px] ${
              active
                ? "bg-bg-base font-semibold text-text shadow-e1"
                : pre === "hidden-light"
                  ? "font-medium text-text-tertiary dark:bg-bg-base dark:font-semibold dark:text-text dark:shadow-e1"
                  : pre === "hidden-dark"
                    ? "bg-bg-base font-semibold text-text shadow-e1 dark:bg-transparent dark:font-medium dark:text-text-tertiary dark:shadow-none"
                    : "font-medium text-text-tertiary"
            }`}
          >
            {label}
          </button>
        );
      })}
    </fieldset>
  );
}
