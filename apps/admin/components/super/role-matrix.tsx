"use client";

import { cn } from "@matr/ui";
import {
  columnEnabled,
  LEVEL_COLUMNS,
  LEVEL_LABEL,
  type LevelColumn,
  MATRIX_ROWS,
  menuPreview,
  rowCaption,
  rowLevel,
  setRowLevel,
} from "../../lib/super/matrix";
import type { Permissions } from "../../lib/super/types";
import { FOCUS } from "./ui";

/**
 * The permission matrix (Figma SA4.2 / SA4.3): Area, None, View, Edit, Manage. One radio group per
 * row. From 768px it is a grid with a header row; on phones every row is a card whose four options
 * carry visible labels. Edit is shown but never selectable (the backend stores none/view/manage).
 */
export function RoleMatrix({
  permissions,
  onChange,
  readOnly,
}: {
  permissions: Permissions;
  onChange?: (next: Permissions) => void;
  readOnly: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-soft bg-bg-base">
      <div
        aria-hidden="true"
        className="hidden h-10 grid-cols-[minmax(0,1fr)_repeat(4,88px)] items-center bg-bg-fill1 pr-2 pl-4 font-medium text-[14px] text-text-secondary tracking-[-0.14px] md:grid"
      >
        <span>Area</span>
        {LEVEL_COLUMNS.map((c) => (
          <span key={c} className="text-center">
            {LEVEL_LABEL[c]}
          </span>
        ))}
      </div>
      {MATRIX_ROWS.map((row) => {
        const current = rowLevel(permissions, row);
        const caption = rowCaption(permissions, row);
        return (
          <fieldset
            key={row.key}
            className="m-0 grid grid-cols-1 gap-2 border-0 border-border-soft border-t p-4 first:border-t-0 md:min-h-12 md:grid-cols-[minmax(0,1fr)_repeat(4,88px)] md:items-center md:gap-0 md:py-2.5 md:pr-2 md:pl-4"
          >
            <legend className="sr-only">{row.label}</legend>
            <div className="min-w-0">
              <p className="text-[14px] text-text leading-5 tracking-[-0.14px]">{row.label}</p>
              {caption ? (
                <p className="text-[13px] text-text-tertiary leading-[18px]">{caption}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-4 gap-1 md:contents">
              {LEVEL_COLUMNS.map((column) => (
                <Cell
                  key={column}
                  name={row.key}
                  column={column}
                  checked={column !== "edit" && current === column}
                  disabled={readOnly || !columnEnabled(row, column)}
                  readOnly={readOnly}
                  onSelect={() =>
                    column !== "edit" &&
                    onChange?.(setRowLevel(permissions, row, column as "none" | "view" | "manage"))
                  }
                  rowLabel={row.label}
                />
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function Cell({
  name,
  column,
  checked,
  disabled,
  readOnly,
  onSelect,
  rowLabel,
}: {
  name: string;
  column: LevelColumn;
  checked: boolean;
  disabled: boolean;
  readOnly: boolean;
  onSelect: () => void;
  rowLabel: string;
}) {
  const hint = column === "edit" && !readOnly ? "Edit isn’t stored separately yet" : undefined;
  return (
    <label
      title={hint}
      className={cn(
        "flex flex-col items-center gap-1 py-1 md:py-0",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <input
        type="radio"
        name={name}
        value={column}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        aria-label={`${rowLabel}: ${LEVEL_LABEL[column]}`}
        className={cn("size-5 accent-primary", FOCUS)}
      />
      <span className="text-[12px] text-text-tertiary leading-4 md:sr-only">
        {LEVEL_LABEL[column]}
      </span>
    </label>
  );
}

/** "Menu preview: what people with this role will see" (live sidebar items). */
export function MenuPreview({ permissions }: { permissions: Permissions }) {
  const items = menuPreview(permissions);
  return (
    <aside
      aria-labelledby="menu-preview"
      className="flex flex-col gap-1 rounded-2xl bg-bg-fill1 p-4 xl:sticky xl:top-4"
    >
      <h2 id="menu-preview" className="font-medium text-[14px] text-text leading-5">
        Menu preview
      </h2>
      <p className="mb-2 text-[13px] text-text-tertiary leading-[18px]">
        What people with this role will see
      </p>
      <ul aria-live="polite" className="flex flex-col gap-0.5">
        {items.length === 0 ? (
          <li className="py-2 text-[14px] text-text-tertiary">Nothing yet. Pick a level above.</li>
        ) : (
          items.map((item) => (
            <li
              key={item.area}
              className="rounded-xl px-3 py-2 text-[14px] text-text-secondary leading-5"
            >
              {item.label}
              {item.note ? (
                <span className="block text-[12px] text-text-tertiary">{item.note}</span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
