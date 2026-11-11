import Link from "next/link";
import type { ReactNode } from "react";
import { initials } from "../../lib/people/format";
import type { Tone } from "../../lib/people/logic";

/** Small building blocks for the People screens (copied from the learner app's patterns). */

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border";

const BTN =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 font-medium text-[14px] leading-5 tracking-[-0.14px] disabled:cursor-not-allowed disabled:opacity-60";
export const BTN_PRIMARY = `${BTN} bg-text text-bg-base hover:opacity-90 ${FOCUS}`;
export const BTN_SECONDARY = `${BTN} border border-border bg-bg-base text-text shadow-e1 hover:bg-bg-fill1 ${FOCUS}`;
export const BTN_DANGER = `${BTN} bg-[#f83b3b] text-static-white hover:opacity-90 ${FOCUS}`;
export const BTN_DANGER_OUTLINE = `${BTN} border border-error-border bg-bg-base text-error-text hover:bg-error-accent ${FOCUS}`;

export const FIELD =
  "w-full rounded-lg border border-border bg-bg-base px-3 text-[14px] text-text leading-5 tracking-[-0.14px] placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-border disabled:opacity-60";
export const INPUT = `${FIELD} h-10`;
export const TEXTAREA = `${FIELD} min-h-[96px] resize-y py-2.5`;
export const LABEL = "text-[14px] font-medium text-text leading-5 tracking-[-0.14px]";

export const CARD = "rounded-2xl border border-border bg-bg-base";
export const BAR = "rounded-md bg-bg-fill2 motion-safe:animate-pulse";

export function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export const PATHS = {
  back: "M19 12H5M12 19l-7-7 7-7",
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-1 1 9 7 9-7",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  alert: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16h.01",
  check: "M5 12.5l4.5 4.5L19 7.5",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l3 3 5-6",
  filter: "M4 6h16M7 12h10M10 18h4",
  x: "M6 6l12 12M18 6L6 18",
  chevron: "M6 9l6 6 6-6",
  scroll: "M8 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8M8 4a2 2 0 0 0-2 2v10M8 4v16M12 9h4M12 13h4",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  headset: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H4zM17 14h3v5h-3zM17 19c0 1.5-2 2-5 2",
} as const;

const TONES: Record<Tone, string> = {
  success: "bg-success-focus text-success-text",
  warning: "bg-primary-accent text-primary-text",
  error: "bg-error-focus text-error-text",
  info: "bg-info-focus text-text",
  neutral: "bg-bg-fill2 text-text-secondary",
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-md px-1.5 text-[12px] font-medium leading-4 tracking-[-0.12px] ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Pill used for tabs (dark when selected) and filters. */
export function Chip({
  selected,
  onClick,
  children,
  count,
  role,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number | null;
  role?: "tab";
}) {
  return (
    <button
      type="button"
      {...(role ? { role, "aria-selected": selected } : { "aria-pressed": selected })}
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[14px] leading-5 tracking-[-0.14px] ${FOCUS} ${
        selected
          ? "border-text bg-text font-medium text-bg-base"
          : "border-border bg-bg-base text-text-secondary hover:bg-bg-fill1 hover:text-text"
      }`}
    >
      {children}
      {typeof count === "number" ? (
        <span className={selected ? "text-bg-base/80" : "text-text-tertiary"}>
          {count.toLocaleString("en-GB")}
        </span>
      ) : null}
    </button>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: 28 | 32 | 40 }) {
  const box =
    size === 28 ? "size-7 text-[11px]" : size === 32 ? "size-8 text-[12px]" : "size-10 text-[14px]";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-bg-fill2 font-medium text-text-secondary ${box}`}
    >
      {initials(name)}
    </span>
  );
}

export function PageHeader({
  title,
  intro,
  aside,
  badge,
}: {
  title: string;
  intro?: ReactNode;
  aside?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-medium text-[30px] text-text leading-9 tracking-[-0.6px] md:text-[34px] md:leading-10 md:tracking-[-0.68px]">
            {title}
          </h1>
          {badge}
        </div>
        {intro ? (
          <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px] md:text-[16px] md:leading-6">
            {intro}
          </p>
        ) : null}
      </div>
      {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
    </header>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 self-start rounded-md text-[14px] text-text-secondary leading-5 tracking-[-0.14px] hover:text-text ${FOCUS}`}
    >
      <Icon d={PATHS.back} />
      {children}
    </Link>
  );
}

/** Centred empty / error block. */
export function StateBlock({
  title,
  body,
  children,
  role,
  icon = PATHS.search,
}: {
  title: string;
  body: string;
  children?: ReactNode;
  role?: "alert" | "status";
  icon?: string;
}) {
  return (
    <div
      role={role}
      className="mx-auto flex max-w-[420px] flex-col items-center gap-3 px-2 py-16 text-center"
    >
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full border-[1.5px] border-border border-dashed bg-bg-fill1 text-text-secondary"
      >
        <Icon d={icon} size={22} />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">{title}</h2>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">{body}</p>
      </div>
      {children ? <div className="flex flex-wrap justify-center gap-2 pt-1">{children}</div> : null}
    </div>
  );
}

export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <StateBlock
      role="alert"
      icon={PATHS.alert}
      title={`We couldn’t load ${what}`}
      body="Try again in a moment. Nothing was changed."
    >
      <button type="button" onClick={onRetry} className={BTN_PRIMARY}>
        Try again
      </button>
    </StateBlock>
  );
}

export function OfflineNote() {
  return (
    <p
      role="status"
      className="rounded-lg border border-warning-border bg-warning-accent px-3 py-2 text-[14px] text-warning-text leading-5"
    >
      You’re offline. What you see may be out of date, and changes can’t be saved until you’re back.
    </p>
  );
}

/** Notice strip (profile hidden, suspended, reply hint, SLA). */
export function Notice({
  tone,
  icon,
  children,
}: {
  tone: "warning" | "error" | "neutral";
  icon: string;
  children: ReactNode;
}) {
  const cls = {
    warning: "bg-warning-accent text-warning-text",
    error: "bg-error-accent text-error-text",
    neutral: "bg-bg-fill1 text-text-secondary",
  }[tone];
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[14px] leading-5 tracking-[-0.14px] ${cls}`}
    >
      <span className="shrink-0">
        <Icon d={icon} />
      </span>
      <p className="min-w-0">{children}</p>
    </div>
  );
}

/** Label / value rows inside a card. */
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="flex flex-col gap-3">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[110px_1fr] gap-3 text-[14px] leading-5 tracking-[-0.14px]"
        >
          <dt className="text-text-secondary">{label}</dt>
          <dd className="min-w-0 break-words text-text">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
