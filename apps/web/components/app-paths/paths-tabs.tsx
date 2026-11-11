"use client";

import { type KeyboardEvent, useRef } from "react";
import { FOCUS } from "../app/ui";

export type PathsTab = "explore" | "mine";

const TABS: { value: PathsTab; label: string }[] = [
  { value: "explore", label: "Explore" },
  { value: "mine", label: "My paths" },
];

export const tabId = (tab: PathsTab) => `paths-tab-${tab}`;
export const panelId = (tab: PathsTab) => `paths-panel-${tab}`;

/** "Explore / My paths" tabs (Figma): left and right arrows move between them, Home and End jump. */
export function PathsTabs({
  value,
  onChange,
  mineCount,
}: {
  value: PathsTab;
  onChange: (tab: PathsTab) => void;
  /** Shown as a badge on My paths when the learner has any; there is no source for it yet. */
  mineCount?: number;
}) {
  const refs = useRef<Record<PathsTab, HTMLButtonElement | null>>({ explore: null, mine: null });
  const tab =
    "-mb-px flex items-center gap-1.5 border-b-2 px-1 py-2.5 text-[14px] leading-5 tracking-[-0.14px] rounded-t-md";

  function onKeyDown(event: KeyboardEvent) {
    const index = TABS.findIndex((t) => t.value === value);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % TABS.length
        : event.key === "ArrowLeft"
          ? (index - 1 + TABS.length) % TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? TABS.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    const target = TABS[next];
    if (!target) return;
    onChange(target.value);
    refs.current[target.value]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Paths"
      onKeyDown={onKeyDown}
      className="flex gap-3 border-border-alpha border-b"
    >
      {TABS.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(node) => {
              refs.current[t.value] = node;
            }}
            id={tabId(t.value)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId(t.value)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={`${tab} font-medium ${FOCUS} ${
              active
                ? "border-primary text-text"
                : "border-transparent text-text-secondary hover:text-text"
            }`}
          >
            <span className="px-0.5">{t.label}</span>
            {t.value === "mine" && mineCount ? (
              <span className="rounded-full border border-border-soft px-1.5 text-[12px] text-text-secondary leading-4">
                {mineCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
