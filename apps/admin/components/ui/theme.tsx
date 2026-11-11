"use client";

import { useEffect, useState } from "react";
import {
  applyThemeChoice,
  readThemeChoice,
  THEME_EVENT,
  type ThemeChoice,
  themeInitScript,
} from "../../lib/session/theme";
import { FOCUS } from "./focus";

/** Inline no-flash script; render once near the top of a layout. */
export function ThemeInit() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party theme script
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

/** Dark / Light / System switch (Figma "Theme Switch"). Only the preference is stored. */
export function ThemeSwitch({ name }: { name: string }) {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);
  useEffect(() => {
    const read = () => setChoice(readThemeChoice());
    read();
    window.addEventListener(THEME_EVENT, read);
    return () => window.removeEventListener(THEME_EVENT, read);
  }, []);

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
            onClick={() => {
              setChoice(value);
              applyThemeChoice(value);
            }}
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
