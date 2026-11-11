"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  LEVEL_LABEL,
  LEVELS,
  type LevelFilter,
  pathCount,
  type TopicFilter,
} from "../../lib/app/paths-catalogue";
import { useMediaQuery, usePopover } from "../app/hooks";
import { ChevronDownIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { BottomSheet } from "./filter-sheet";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "./parts";

/** Chips and the level filter of the Paths catalogue (Figma "Filters": chips, Level, phone "Filters"). */

export function Chip({
  active,
  label,
  onClick,
  inert = false,
}: {
  active: boolean;
  label: string;
  onClick?: () => void;
  /** A chip drawn in a loading skeleton: not interactive. */
  inert?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={inert ? undefined : active}
      disabled={inert}
      tabIndex={inert ? -1 : undefined}
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-[14px] leading-5 tracking-[-0.14px] transition-colors ${FOCUS} ${
        active
          ? "bg-text text-bg-base"
          : "border border-border-soft text-text-secondary enabled:hover:bg-bg-fill1 enabled:hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

/** Topic filter chips (a button group: each chip is aria-pressed). The row scrolls on phones. */
export function TopicChips({
  topics,
  value,
  onChange,
}: {
  topics: { slug: string; name: string }[];
  value: TopicFilter;
  onChange: (topic: TopicFilter) => void;
}) {
  const chips: { slug: TopicFilter; name: string }[] = [
    { slug: "all", name: "All" },
    ...topics.map((t) => ({ slug: t.slug as TopicFilter, name: t.name })),
  ];
  return (
    <fieldset className="m-0 -mx-5 min-w-0 flex-1 border-0 p-0 px-5 md:mx-0 md:px-0">
      <legend className="sr-only">Filter paths by topic</legend>
      <div className="-m-1 flex gap-2 overflow-x-auto p-1 md:flex-wrap md:overflow-visible">
        {chips.map((chip) => (
          <Chip
            key={chip.slug}
            active={chip.slug === value}
            onClick={() => onChange(chip.slug)}
            label={chip.name}
          />
        ))}
      </div>
    </fieldset>
  );
}

const TRIGGER = `inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevation-1 px-2.5 py-2 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] shadow-e1 ${FOCUS}`;

const levelOptions: { value: LevelFilter; label: string }[] = [
  { value: "all", label: "All levels" },
  ...LEVELS.map((level) => ({ value: level, label: LEVEL_LABEL[level] })),
];

/**
 * The level filter. From md up it is "Level: All levels" opening a small popover (LevelPopover);
 * on phones it is "Filters" (with "· 1" once a level is chosen) opening a bottom sheet
 * (LevelSheet), as in the phone frames.
 */
export function LevelPopover({
  value,
  onChange,
  className,
}: {
  value: LevelFilter;
  onChange: (level: LevelFilter) => void;
  className: string;
}) {
  const { open, setOpen, toggle, buttonRef, panelRef } = usePopover();
  const id = useId();
  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className={TRIGGER}
      >
        <span className="px-0.5">Level: {value === "all" ? "All levels" : LEVEL_LABEL[value]}</span>
        <ChevronDownIcon size={20} />
      </button>
      {open ? (
        <div
          id={id}
          ref={panelRef}
          className="absolute top-full right-0 z-20 mt-2 w-[200px] rounded-lg border border-border-soft bg-bg-base p-2 shadow-e2"
        >
          <fieldset className="m-0 flex flex-col gap-0.5 border-0 p-0">
            <legend className="px-2 pt-1 pb-1.5 font-medium text-[12px] text-text-tertiary leading-4">
              Level
            </legend>
            {levelOptions.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`rounded-md px-2 py-1.5 text-left font-medium text-[14px] leading-5 tracking-[-0.14px] ${FOCUS} ${
                    active ? "bg-primary-focus text-primary-text" : "text-text hover:bg-bg-fill1"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}

export function LevelSheet({
  value,
  onChange,
  countFor,
  className,
}: {
  value: LevelFilter;
  onChange: (level: LevelFilter) => void;
  countFor: (level: LevelFilter) => number;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LevelFilter>(value);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const wide = useMediaQuery("(min-width: 768px)");
  useEffect(() => {
    if (wide) setOpen(false);
  }, [wide]);

  const show = (level: LevelFilter) => {
    setDraft(level);
    setOpen(true);
  };
  const shown = countFor(draft);
  return (
    <div className={`shrink-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => show(value)}
        className={TRIGGER}
      >
        <span className="px-0.5">{value === "all" ? "Filters" : "Filters · 1"}</span>
        <ChevronDownIcon size={20} />
      </button>
      {open ? (
        <BottomSheet
          id={id}
          title="Filters"
          onClose={() => setOpen(false)}
          returnFocusTo={buttonRef}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDraft("all")}
                disabled={draft === "all"}
                className={`${BUTTON_SECONDARY} h-11 flex-1 disabled:opacity-50`}
              >
                Clear
              </button>
              <button
                type="button"
                disabled={shown === 0}
                onClick={() => {
                  onChange(draft);
                  setOpen(false);
                }}
                className={`${BUTTON_PRIMARY} h-11 flex-[2] disabled:opacity-50`}
              >
                {shown === 0 ? "No paths" : `Show ${pathCount(shown)}`}
              </button>
            </>
          }
        >
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="pb-2 font-medium text-[12px] text-text-tertiary leading-4">
              Level
            </legend>
            {levelOptions.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-[16px] text-text leading-6 tracking-[-0.16px] has-checked:bg-primary-focus has-checked:text-primary-text has-focus-visible:outline-2 has-focus-visible:outline-primary-border"
              >
                <span>{option.label}</span>
                <span className="text-[13px] text-text-tertiary leading-[18px]">
                  {countFor(option.value)}
                </span>
                <input
                  type="radio"
                  name={`${id}-level`}
                  checked={draft === option.value}
                  onChange={() => setDraft(option.value)}
                  className="sr-only"
                />
              </label>
            ))}
          </fieldset>
        </BottomSheet>
      ) : null}
    </div>
  );
}
