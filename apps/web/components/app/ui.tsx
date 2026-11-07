"use client";

import { useEffect, useState } from "react";
import { initials } from "../../lib/app/profile";
import type { Me } from "../../lib/auth/api";
import { THEME_STORAGE_KEY } from "../../lib/theme";

/** Small building blocks shared by the app shell and the dashboard. */

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border";

/** The orange-tinted initials circle used in place of a profile photo (there is no photo upload yet). */
export function Avatar({ me, size }: { me: Pick<Me, "name" | "email">; size: 36 | 40 | 48 }) {
  const box =
    size === 36 ? "size-9 text-[13px]" : size === 40 ? "size-10 text-sm" : "size-12 text-base";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-focus font-semibold text-primary-text tracking-[-0.14px] ${box}`}
    >
      {initials(me)}
    </span>
  );
}

/**
 * Theme choice (Figma "Theme Switch": Dark / Light / System), same behaviour as the marketing
 * footer: "System" clears the stored override and follows the OS (lib/theme.ts). Only the theme
 * preference is stored in the browser, never anything about the session.
 */
const THEME_EVENT = "matr:theme-change";
type Choice = "dark" | "light" | "system";
const OPTIONS: { value: Choice; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

export function ThemeSwitch({ name }: { name: string }) {
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        setChoice(stored === "light" || stored === "dark" ? stored : "system");
      } catch {
        setChoice("system");
      }
    };
    read();
    // The sidebar and the profile menu each have a switch: keep them in step.
    window.addEventListener(THEME_EVENT, read);
    return () => window.removeEventListener(THEME_EVENT, read);
  }, []);

  function select(next: Choice) {
    setChoice(next);
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = next === "system" ? (dark ? "dark" : "light") : next;
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the choice still applies for this visit.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <fieldset
      className="m-0 flex h-[42px] min-w-0 gap-0.5 rounded-xl border-0 bg-bg-fill2 p-1"
      aria-label={`${name} theme`}
    >
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map(({ value, label }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => select(value)}
            className={`flex h-full min-w-0 flex-1 items-center justify-center rounded-[9px] py-[7px] text-[14px] leading-5 tracking-[-0.14px] ${FOCUS} ${
              active
                ? "bg-bg-base font-semibold text-text shadow-e1"
                : "font-medium text-text-tertiary hover:text-text"
            }`}
          >
            {label}
          </button>
        );
      })}
    </fieldset>
  );
}
