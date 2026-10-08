"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  chooseTheme,
  clearThemeChoice,
  currentTheme,
  type Theme,
} from "../../lib/theme";
import { asset, ThemedImg } from "./primitives";

/**
 * Footer theme switch (Figma: theme-toggle 62:871 light / 66:499 dark). The visuals (icons,
 * knob position) come from CSS via [data-theme], so they are right before hydration; React
 * state only drives aria-checked.
 * The system setting is the default: a toggle back to the system theme clears the override,
 * and a change of the system setting always wins over an earlier toggle.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(currentTheme());
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = (event: MediaQueryListEvent) => {
      const next: Theme = event.matches ? "dark" : "light";
      clearThemeChoice();
      applyTheme(next);
      setTheme(next);
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  const isDark = theme === "dark";

  function toggle() {
    const next: Theme = isDark ? "light" : "dark";
    chooseTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      onClick={toggle}
      className="group flex h-9 items-center gap-2 rounded-full border border-border-soft-alpha bg-bg-base p-2 transition-colors duration-500 ease-smooth hover:border-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
    >
      <ThemedImg
        name="icon-sun.svg"
        className="block size-[18px] transition-transform duration-500 group-hover:rotate-90"
      />
      <span className="relative h-4 w-8">
        {/* Knob left (light) and knob right (dark) are separate exports with different insets. */}
        <span className="absolute inset-[-6.25%_0_-18.75%_-6.25%] dark:hidden">
          <img
            decoding="async"
            loading="lazy"
            alt=""
            src={asset("toggle-switch.svg")}
            className="block size-full max-w-none"
          />
        </span>
        <span className="absolute inset-[-6.25%_-6.25%_-18.75%_0] hidden dark:block">
          <img
            decoding="async"
            loading="lazy"
            alt=""
            src={asset("toggle-switch-dark.svg")}
            className="block size-full max-w-none"
          />
        </span>
      </span>
      <ThemedImg
        name="icon-moon.svg"
        className="block size-[18px] transition-transform duration-500 group-hover:-rotate-[25deg]"
      />
    </button>
  );
}
