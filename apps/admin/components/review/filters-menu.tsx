"use client";

import { useEffect, useRef, useState } from "react";
import type { ListFilters } from "../../lib/review/api";
import { TOPIC_OPTIONS } from "../../lib/review/options";
import type { QueueKey } from "../../lib/review/types";
import { Field, Select } from "./fields";
import { FilterIcon } from "./icons";
import { Button, FOCUS } from "./ui";

const STATUS: Record<QueueKey, { value: string; label: string }[]> = {
  submissions: [
    { value: "in_review", label: "Waiting for review" },
    { value: "needs_changes", label: "Waiting on the submitter" },
  ],
  "link-reports": [
    { value: "open", label: "Open" },
    { value: "handled", label: "Handled" },
  ],
  "profile-reports": [
    { value: "open", label: "Open" },
    { value: "handled", label: "Handled" },
  ],
};

/** The 94px "Filters" button and its popover: status, and topic for submissions. */
export function FiltersMenu({
  tab,
  value,
  onApply,
}: {
  tab: QueueKey;
  value: Pick<ListFilters, "status" | "topic">;
  onApply: (next: Pick<ListFilters, "status" | "topic">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const active = Number(Boolean(value.status)) + Number(Boolean(value.topic));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          setDraft(value);
          setOpen((o) => !o);
        }}
        className={`inline-flex h-10 min-w-[94px] items-center justify-center gap-2 rounded-lg border border-border bg-bg-base px-3 text-[13px] font-medium text-text hover:bg-bg-fill1 ${FOCUS}`}
      >
        <FilterIcon />
        Filters{active > 0 ? ` (${active})` : ""}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 flex w-[280px] flex-col gap-3 rounded-2xl border border-border bg-bg-elevation-1 p-4 shadow-xl">
          <Field label="Status" htmlFor="rv-f-status">
            <Select
              id="rv-f-status"
              value={draft.status ?? ""}
              placeholder="Any status"
              options={STATUS[tab]}
              onChange={(e) => setDraft({ ...draft, status: e.target.value || undefined })}
            />
          </Field>
          {tab === "submissions" ? (
            <Field label="Topic" htmlFor="rv-f-topic">
              <Select
                id="rv-f-topic"
                value={draft.topic ?? ""}
                placeholder="Any topic"
                options={TOPIC_OPTIONS}
                onChange={(e) => setDraft({ ...draft, topic: e.target.value || undefined })}
              />
            </Field>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                onApply({});
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
