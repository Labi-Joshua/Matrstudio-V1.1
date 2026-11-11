"use client";

import { type ReactNode, useEffect, useId } from "react";
import type { LibraryModel } from "../../lib/app/library-data";
import { TYPE_OPTIONS, type TypeFilter } from "../../lib/app/library-filters";
import { usePopover } from "../app/hooks";
import { ChevronDownIcon, LibraryIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { CheckIcon, KIND_ICON } from "./art";

/**
 * Library filter controls (Figma "Type filter open"); the phone sheet is in filters-sheet.tsx.
 *  - Topic chips: toggle buttons (aria-pressed), one active at a time.
 *  - Type and Source menus (md and up): a button that opens a panel of native radios, so arrow
 *    keys move the choice; Escape, Tab out or a press outside closes, and focus lands on the
 *    current choice when opened.
 */

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 font-medium text-[14px] leading-5 tracking-[-0.14px] ${FOCUS} ${
        active
          ? "bg-text text-bg-base"
          : "border border-border-soft text-text-secondary hover:bg-bg-fill1 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

export function TopicChips({
  topics,
  value,
  onChange,
  className = "",
}: {
  topics: LibraryModel["topics"];
  value: string;
  onChange: (topic: string) => void;
  className?: string;
}) {
  return (
    <fieldset className={`m-0 min-w-0 border-0 p-0 ${className}`}>
      <legend className="sr-only">Filter by topic</legend>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        <Chip active={value === "all"} onClick={() => onChange("all")}>
          All
        </Chip>
        {topics.map((topic) => (
          <Chip key={topic.slug} active={value === topic.slug} onClick={() => onChange(topic.slug)}>
            {topic.name}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

type Option = { value: string; label: string; icon?: ReactNode };

/** "Type: All types" button with a radio panel under it. */
export function SelectMenu({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { open, toggle, close, buttonRef, panelRef } = usePopover();
  const name = useId();
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
  }, [open, panelRef]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={toggle}
        className={`flex h-9 items-center gap-1.5 rounded-lg border border-border-soft bg-bg-base px-3 text-[14px] text-text leading-5 tracking-[-0.14px] hover:bg-bg-fill1 ${FOCUS}`}
      >
        <span className="text-text-secondary">{label}:</span>
        <span className="font-medium">{current?.label}</span>
        <ChevronDownIcon size={16} className="text-text-tertiary" />
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="radiogroup"
          aria-label={label}
          className="absolute top-full right-0 z-20 mt-2 flex max-h-[320px] w-[220px] flex-col gap-0.5 overflow-y-auto rounded-xl border border-border-soft bg-bg-base p-1.5 shadow-e2"
        >
          {options.map((option) => (
            <label
              key={option.value}
              className="relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[14px] text-text leading-5 tracking-[-0.14px] hover:bg-bg-fill1 has-[:checked]:bg-bg-fill1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-border"
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={option.value === value}
                onChange={() => onChange(option.value)}
                onClick={(event) => {
                  // A mouse or touch pick closes the panel; arrow keys keep it open to browse.
                  if (event.detail > 0) close();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") close();
                }}
                className="sr-only"
              />
              {option.icon ? (
                <span aria-hidden="true" className="text-text-secondary">
                  {option.icon}
                </span>
              ) : null}
              <span className="flex-1">{option.label}</span>
              {option.value === value ? (
                <CheckIcon size={16} className="text-text-secondary" />
              ) : null}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Glyph for a type choice: the library mark for "All types", else the card badge icon. */
export function TypeIcon({ type, size = 16 }: { type: TypeFilter; size?: number }) {
  if (type === "all") return <LibraryIcon size={size} />;
  const Icon = KIND_ICON[type];
  return <Icon size={size} />;
}

export function typeOptions(): Option[] {
  return TYPE_OPTIONS.map(({ value, label }) => ({
    value,
    label,
    icon: <TypeIcon type={value} />,
  }));
}
