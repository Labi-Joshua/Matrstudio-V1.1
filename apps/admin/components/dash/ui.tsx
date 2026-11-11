"use client";

import type { ReactNode } from "react";
import type { ApiFailure } from "../../lib/api";
import { useOnline } from "../../lib/dash/hooks";
import { AlertIcon } from "./icons";

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border";

export const BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-alpha bg-bg-base px-4 text-[14px] leading-5 text-text transition-colors hover:bg-bg-fill1 disabled:opacity-60";

export const LINK_ACCENT = `rounded text-[14px] leading-5 text-primary-text hover:underline ${FOCUS}`;

export function Card({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={`min-w-0 rounded-2xl border border-border-alpha bg-bg-base p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[14px] font-normal leading-5 text-text">{title}</h2>
      {action}
    </div>
  );
}

/** Pulsing placeholder bar; reduced motion keeps it still. */
export function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded-md bg-bg-fill2 motion-safe:animate-pulse ${className}`} />;
}

/** One polite status line for screen readers (loading and result changes). */
export function Status({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  );
}

export function ErrorPanel({
  title,
  body,
  error,
  onRetry,
}: {
  title: string;
  body: string;
  error?: ApiFailure;
  onRetry: () => void;
}) {
  const online = useOnline();
  const offline = !online || error?.code === "network_error";
  const forbidden = error?.code === "forbidden";
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-border-alpha px-6 py-16 text-center"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-error-accent text-error-text">
        <AlertIcon />
      </span>
      <h2 className="text-[16px] font-medium leading-6 text-text">
        {offline ? "You appear to be offline" : forbidden ? "You can’t see this page" : title}
      </h2>
      <p className="max-w-[420px] text-[14px] leading-5 text-text-secondary">
        {offline
          ? "Check your connection, then try again."
          : forbidden
            ? "Your role doesn’t include this part of the portal. Ask a Super admin if you need it."
            : body}
      </p>
      {forbidden ? null : (
        <button type="button" onClick={onRetry} className={`${BUTTON} mt-1 ${FOCUS}`}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyNote({
  icon,
  title,
  body,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-1.5 text-center ${compact ? "py-8" : "py-14"}`}>
      {icon ? (
        <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-bg-fill2 text-text-secondary">
          {icon}
        </span>
      ) : null}
      <p className="text-[14px] font-medium leading-5 text-text">{title}</p>
      <p className="max-w-[360px] text-[13px] leading-5 text-text-secondary">{body}</p>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[24px] font-medium leading-8 tracking-[-0.24px] text-text">{title}</h1>
        <p className="mt-1 text-[14px] leading-5 text-text-secondary">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
