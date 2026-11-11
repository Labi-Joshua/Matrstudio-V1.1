"use client";

import { type KeyboardEvent, useState } from "react";
import { move, removeAt } from "../../lib/settings/logic";
import { FOCUS, GripIcon, LINK_MUTED } from "./ui";

export type CurationRow = { id: string; title: string; meta: string };

/**
 * An ordered, reorderable list (featured paths, library picks). Drag a row by its handle with the
 * mouse or touch, or focus the handle and press the up and down arrow keys. `announce` receives a
 * sentence for the page's live region after each move.
 */
export function CurationList({
  label,
  rows,
  canEdit,
  emptyText,
  onChange,
  announce,
}: {
  label: string;
  rows: CurationRow[];
  canEdit: boolean;
  emptyText: string;
  onChange: (order: string[]) => void;
  announce: (text: string) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const ids = rows.map((r) => r.id);

  function moveTo(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to) return;
    onChange(move(ids, from, to));
    announce(`${rows[from]?.title} moved to position ${to + 1} of ${rows.length}.`);
  }

  function onKey(event: KeyboardEvent, index: number) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const to = index + (event.key === "ArrowUp" ? -1 : 1);
    moveTo(index, to);
    // The row re-renders in its new place; keep focus on its handle.
    const handleId = rows[index]?.id;
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-handle="${CSS.escape(`${label}:${handleId}`)}"]`)
        ?.focus(),
    );
  }

  if (rows.length === 0)
    return (
      <p className="rounded-xl bg-bg-fill1 px-4 py-6 text-center text-[14px] text-text-secondary leading-5">
        {emptyText}
      </p>
    );

  return (
    <ol aria-label={label} className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <li
          key={row.id}
          draggable={canEdit}
          onDragStart={(event) => {
            setDragging(index);
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(event) => {
            if (dragging === null) return;
            event.preventDefault();
            setOver(index);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragging !== null) moveTo(dragging, index);
            setDragging(null);
            setOver(null);
          }}
          onDragEnd={() => {
            setDragging(null);
            setOver(null);
          }}
          className={`flex items-center gap-3 rounded-xl bg-bg-fill1 px-3 py-3 ${over === index && dragging !== index ? "outline-2 outline-primary-border outline-dashed" : ""} ${dragging === index ? "opacity-50" : ""}`}
        >
          {canEdit ? (
            <button
              type="button"
              data-handle={`${label}:${row.id}`}
              onKeyDown={(event) => onKey(event, index)}
              aria-label={`Reorder ${row.title}, position ${index + 1} of ${rows.length}. Use the up and down arrow keys.`}
              className={`flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-text-tertiary hover:text-text ${FOCUS}`}
            >
              <GripIcon size={16} />
            </button>
          ) : null}
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-bg-base font-medium text-[12px] text-text-secondary"
          >
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14px] text-text leading-5">{row.title}</span>
            {row.meta ? (
              <span className="truncate text-[12px] text-text-tertiary leading-4">{row.meta}</span>
            ) : null}
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => {
                onChange(removeAt(ids, index));
                announce(`${row.title} removed.`);
              }}
              aria-label={`Remove ${row.title}`}
              className={LINK_MUTED}
            >
              Remove
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
