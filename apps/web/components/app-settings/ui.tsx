"use client";

import type { ReactNode } from "react";
import { FOCUS } from "../app/ui";

/** Building blocks shared by the Settings sections (Figma "Settings: account" and siblings). */

export const BTN_SMALL = `btn-lift inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-base px-3 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] shadow-e1 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${FOCUS}`;
export const BTN_PRIMARY_S = `btn-lift inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 font-medium text-[14px] text-static-white leading-5 tracking-[-0.14px] aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${FOCUS}`;
export const LINK_BUTTON = `rounded-sm font-medium text-[14px] leading-5 tracking-[-0.14px] hover:underline ${FOCUS}`;

/** A titled block with the divider above it (every section but the first). */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-border-soft border-t pt-8 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-[18px] text-text leading-7 tracking-[-0.18px]">{title}</h2>
        {description ? (
          <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** The on/off switch (Figma Toggle): a real button with role="switch". */
export function Switch({
  checked,
  onChange,
  labelledBy,
  describedBy,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  labelledBy: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS} ${
        checked ? "bg-primary" : "bg-bg-fill4"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-static-white shadow-e1 transition-transform motion-reduce:transition-none ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}

/**
 * A setting row on a card (icon tile, title, one line of help, and a control on the right). The
 * card gets the orange border while it is on, as in the design.
 */
export function SettingCard({
  id,
  icon,
  title,
  description,
  on,
  control,
}: {
  id: string;
  icon?: ReactNode;
  title: string;
  description: string;
  on: boolean;
  control: ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 ${
        on ? "border-primary-border" : "border-border-soft"
      }`}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bg-fill1 text-text-secondary"
        >
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <p
          id={`${id}-t`}
          className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]"
        >
          {title}
        </p>
        <p id={`${id}-d`} className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          {description}
        </p>
      </div>
      {control}
    </div>
  );
}
