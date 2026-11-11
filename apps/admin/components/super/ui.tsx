"use client";

import { cn } from "@matr/ui";
import { type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useId } from "react";
import { initials } from "../../lib/super/format";
import { AlertIcon, ChevronDownIcon, WifiOffIcon } from "./icons";

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border";

type ButtonKind = "primary" | "secondary" | "danger" | "danger-outline" | "link" | "link-danger";

const BUTTON: Record<ButtonKind, string> = {
  primary: "h-10 rounded-lg bg-ink px-3.5 text-bg-base shadow-e1 hover:opacity-90",
  secondary:
    "h-10 rounded-lg border border-border bg-bg-elevation-1 px-3 text-text shadow-e1 hover:bg-bg-fill1",
  danger: "h-10 rounded-lg bg-error-text px-3.5 text-static-white shadow-e1 hover:opacity-90",
  "danger-outline":
    "h-10 rounded-lg border border-error-border bg-bg-elevation-1 px-3 text-error-text hover:bg-error-accent",
  link: "rounded-md text-primary-text hover:underline",
  "link-danger": "rounded-md text-error-text hover:underline",
};

export function Button({
  kind = "secondary",
  className,
  type = "button",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonKind }) {
  return (
    <button
      type={type}
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium text-[14px] leading-5 tracking-[-0.14px] disabled:cursor-not-allowed disabled:opacity-50",
        FOCUS,
        BUTTON[kind],
        className,
      )}
    >
      {children}
    </button>
  );
}

type Tone = "neutral" | "orange" | "green" | "blue" | "red" | "amber";
const TONE: Record<Tone, string> = {
  neutral: "border border-border-soft-alpha text-text-secondary",
  orange: "bg-primary-focus text-primary-text",
  green: "bg-success-focus text-success-text",
  blue: "bg-info-focus text-utility-blue dark:text-text",
  red: "bg-error-focus text-error-text",
  amber: "bg-warning-focus text-warning-text",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-[3px] font-medium text-[13px] leading-[18px] tracking-[-0.13px] whitespace-nowrap",
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Tone for a role badge: Super admin orange, Admin blue, Curator green, Support orange-ish, custom neutral. */
export function roleTone(roleId: string, builtIn = true): Tone {
  if (roleId === "super_admin") return "orange";
  if (roleId === "admin") return "blue";
  if (roleId === "curator") return "green";
  if (roleId === "support") return "amber";
  return builtIn ? "neutral" : "orange";
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary-focus font-medium text-primary-text"
    >
      {initials(name)}
    </span>
  );
}

export function StatusDot({ tone }: { tone: "green" | "amber" | "red" | "grey" }) {
  const color = {
    green: "bg-success",
    amber: "bg-warning",
    red: "bg-error-text",
    grey: "bg-text-tertiary",
  }[tone];
  return <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-[3px]", color)} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-medium text-[14px] text-text leading-5">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-[13px] text-error-text leading-[18px]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-text-tertiary leading-[18px]">{hint}</p>
      ) : null}
    </div>
  );
}

export const INPUT =
  "h-10 w-full rounded-[10px] border border-border-soft bg-bg-base px-3 text-[14px] text-text tracking-[-0.14px] placeholder:text-text-tertiary disabled:opacity-60";

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className="relative">
      <select {...rest} className={cn(INPUT, "appearance-none pr-9", FOCUS, className)}>
        {children}
      </select>
      <ChevronDownIcon
        size={16}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-tertiary"
      />
    </div>
  );
}

export function Banner({
  tone = "neutral",
  icon,
  children,
  action,
}: {
  tone?: "neutral" | "warning" | "error";
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  const style = {
    neutral: "bg-bg-fill1 text-text-secondary",
    warning: "bg-warning-accent text-warning-text",
    error: "bg-error-accent text-error-text",
  }[tone];
  return (
    <div
      className={cn("flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[14px] leading-5", style)}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <p className="min-w-0 flex-1 tracking-[-0.14px]">{children}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse rounded-md bg-bg-fill2 motion-reduce:animate-none",
        className,
      )}
    />
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
      <h2 className="font-semibold text-[16px] text-text leading-6">{title}</h2>
      <p className="max-w-[360px] text-[14px] text-text-secondary leading-5">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  offline,
  onRetry,
}: {
  title: string;
  body: string;
  offline?: boolean;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
      <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-error-accent text-error-text">
        {offline ? <WifiOffIcon /> : <AlertIcon />}
      </span>
      <h2 className="font-semibold text-[16px] text-text leading-6">{title}</h2>
      <p className="max-w-[360px] text-[14px] text-text-secondary leading-5">{body}</p>
      <Button className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** The page title block: one h1, subtitle, optional actions on the right (stacked on phones). */
export function PageHeader({
  title,
  subtitle,
  actions,
  badge,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-semibold text-[24px] text-text leading-8 tracking-[-0.24px]">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle ? (
          <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Tab pills (Members / Pending invites). Controlled; arrow keys move between tabs. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const base = useId();
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((tab, index) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            id={`${base}-${tab.value}`}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => {
              const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              const next = tabs[(index + step + tabs.length) % tabs.length];
              if (next) {
                onChange(next.value);
                document.getElementById(`${base}-${next.value}`)?.focus();
              }
            }}
            className={cn(
              "h-8 rounded-full border px-3 font-medium text-[13px] leading-[18px]",
              FOCUS,
              active
                ? "border-ink bg-ink text-bg-base"
                : "border-border-soft bg-bg-base text-text-secondary hover:text-text",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="ml-1.5 opacity-80">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** A bordered card used for the table frames and detail panels. */
export const CARD = "rounded-2xl border border-border-soft bg-bg-base";
