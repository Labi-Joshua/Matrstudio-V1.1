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
import { useMediaQuery } from "../app/hooks";
import { CloseIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { SlidersIcon } from "./art";
import { Chip, TypeIcon } from "./filters";
import { BTN_PRIMARY } from "./ui";

/**
 * Phone "Filters" button (with the number of active filters) and its full-screen sheet (Figma
 * "Library: filters (full screen)"): a native modal <dialog> (focus trap, Escape, focus back on
 * the button). Choices are drafted inside the sheet and applied together with "Show N results";
 * "Clear all" resets the draft. The page behind does not scroll while it is open, and the sheet
 * closes by itself if the window grows to the tablet layout, where the Type menu is used instead.
 */
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
  const tablet = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    if (tablet) ref.current?.close();
  }, [tablet]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="filters-title"
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-bg-base p-0 text-text backdrop:bg-static-black/50 backdrop:backdrop-blur-sm"
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
                const selected = draft.type === option.value;
                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border-soft p-3 has-[:checked]:border-primary-border has-[:checked]:bg-primary-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-border"
                  >
                    <input
                      type="radio"
                      name={typeName}
                      value={option.value}
                      checked={selected}
                      onChange={() => setDraft({ ...draft, type: option.value as TypeFilter })}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bg-fill1 text-text-secondary"
                    >
                      <TypeIcon type={option.value} size={20} />
                    </span>
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
                        {option.label}
                      </span>
                      <span className="text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
                        {option.value === "all"
                          ? `${n} ${n === 1 ? "resource" : "resources"}`
                          : `${n} in the library`}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                        selected ? "border-primary bg-primary" : "border-border"
                      }`}
                    >
                      {selected ? <span className="size-2 rounded-full bg-static-white" /> : null}
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
