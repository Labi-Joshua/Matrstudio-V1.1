"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { LibraryModel } from "../../lib/app/library-data";
import {
  activeFilterCount,
  applyFilters,
  countByType,
  type Filters,
  NO_FILTERS,
  TYPE_OPTIONS,
  type TypeFilter,
} from "../../lib/app/library-filters";
import { usePopover } from "../app/hooks";
import { ChevronDownIcon, CloseIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { CheckIcon, SlidersIcon } from "./art";
import { BTN_PRIMARY } from "./ui";

/**
 * Library filter controls (Figma "Type filter open" and the phone "Filters" sheet).
 *  - Topic chips: toggle buttons (aria-pressed), one active at a time.
 *  - Type and Source menus (desktop): a button that opens a panel of native radios, so arrow keys
 *    move the choice; Escape or Tab out closes, and focus lands on the current choice when opened.
 *  - Phone sheet: a native modal <dialog> (focus trap, Escape, focus back on the button) with the
 *    same choices, applied together with "Show N results".
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

type Option = { value: string; label: string };

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

export function typeOptions(): Option[] {
  return TYPE_OPTIONS.map(({ value, label }) => ({ value, label }));
}

/** Phone "Filters" button (with the number of active filters) and its full-screen sheet. */
export function FilterSheet({
  model,
  filters,
  onApply,
}: {
  model: LibraryModel;
  filters: Filters;
  onApply: (next: Filters) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`flex h-9 items-center gap-1.5 rounded-lg border border-border-soft bg-bg-base px-3 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] ${FOCUS}`}
      >
        <SlidersIcon size={16} />
        Filters
        {count > 0 ? <span aria-hidden="true">· {count}</span> : null}
        {count > 0 ? <span className="sr-only">, {count} active</span> : null}
      </button>
      {open ? (
        <SheetDialog
          model={model}
          initial={filters}
          onClose={() => setOpen(false)}
          onApply={onApply}
        />
      ) : null}
    </>
  );
}

function SheetDialog({
  model,
  initial,
  onClose,
  onApply,
}: {
  model: LibraryModel;
  initial: Filters;
  onClose: () => void;
  onApply: (next: Filters) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Filters>({ ...initial, page: 1 });
  const typeName = useId();
  const shown = applyFilters(model.items, draft).length;
  const counts = countByType(model.items, draft);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="filters-title"
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-bg-base p-0 text-text backdrop:bg-static-black/50"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-border-soft border-b px-4 py-3">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => ref.current?.close()}
            className={`flex size-9 items-center justify-center rounded-lg text-text-secondary hover:text-text ${FOCUS}`}
          >
            <CloseIcon size={20} />
          </button>
          <h2
            id="filters-title"
            className="flex-1 font-medium text-[16px] leading-6 tracking-[-0.16px]"
          >
            Filters
          </h2>
          <button
            type="button"
            onClick={() => setDraft({ ...NO_FILTERS })}
            className={`rounded-md px-1 font-medium text-[14px] text-primary-text leading-5 tracking-[-0.14px] ${FOCUS}`}
          >
            Clear all
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
          <SheetGroup title="Topic">
            <div className="flex flex-wrap gap-2">
              <Chip
                active={draft.topic === "all"}
                onClick={() => setDraft({ ...draft, topic: "all" })}
              >
                All
              </Chip>
              {model.topics.map((topic) => (
                <Chip
                  key={topic.slug}
                  active={draft.topic === topic.slug}
                  onClick={() => setDraft({ ...draft, topic: topic.slug })}
                >
                  {topic.name}
                </Chip>
              ))}
            </div>
          </SheetGroup>

          <SheetGroup title="Type">
            <div role="radiogroup" aria-label="Type" className="flex flex-col gap-2">
              {TYPE_OPTIONS.map((option) => {
                const n = counts[option.value];
                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border-soft p-3 has-[:checked]:border-primary-border has-[:checked]:bg-primary-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-border"
                  >
                    <input
                      type="radio"
                      name={typeName}
                      value={option.value}
                      checked={draft.type === option.value}
                      onChange={() => setDraft({ ...draft, type: option.value as TypeFilter })}
                      className="sr-only"
                    />
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
                        {option.label}
                      </span>
                      <span className="text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
                        {n} {n === 1 ? "resource" : "resources"}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex size-5 items-center justify-center rounded-full border ${
                        draft.type === option.value ? "border-primary-border" : "border-border"
                      }`}
                    >
                      {draft.type === option.value ? (
                        <span className="size-2.5 rounded-full bg-primary" />
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </SheetGroup>

          {model.sources.length > 1 ? (
            <SheetGroup title="Source">
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={draft.source === "all"}
                  onClick={() => setDraft({ ...draft, source: "all" })}
                >
                  All
                </Chip>
                {model.sources.map((source) => (
                  <Chip
                    key={source.slug}
                    active={draft.source === source.slug}
                    onClick={() => setDraft({ ...draft, source: source.slug })}
                  >
                    {source.name}
                  </Chip>
                ))}
              </div>
            </SheetGroup>
          ) : null}
        </div>

        <div className="border-border-soft border-t p-4">
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              // Closing the native dialog (not unmounting it) hands focus back to the Filters button.
              ref.current?.close();
            }}
            className={`${BTN_PRIMARY} w-full`}
          >
            Show {shown} {shown === 1 ? "result" : "results"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function SheetGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="font-mono text-[12px] text-text-tertiary uppercase leading-4 tracking-[0.72px]">
        {title}
      </h3>
      {children}
    </section>
  );
}
