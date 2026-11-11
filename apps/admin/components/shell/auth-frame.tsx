"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { ClockIcon, LockIcon } from "../ui/icons";
import { Wordmark } from "./wordmark";

/**
 * Frame of every sign-in screen (Figma "Admin - Auth and navigation" frames 1 to 9): peach glow
 * background, the wordmark, a 416px card and the "Restricted area. Activity is logged." note.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-bg-base px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-[radial-gradient(60%_80%_at_30%_100%,color-mix(in_srgb,var(--matr-primary)_28%,transparent),transparent),radial-gradient(50%_70%_at_75%_100%,color-mix(in_srgb,var(--matr-primary)_22%,transparent),transparent)]"
      />
      <main className="relative my-auto flex w-full max-w-[416px] flex-col items-center gap-6 py-6">
        <div aria-hidden="true" className="scale-125">
          <Wordmark />
        </div>
        {children}
      </main>
      <p className="relative flex items-center gap-1.5 text-[12px] text-text-secondary leading-4">
        <LockIcon size={14} />
        Restricted area. Activity is logged.
      </p>
    </div>
  );
}

/** The white card. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-5 rounded-3xl border border-border-soft bg-bg-base p-6 shadow-e2">
      {children}
    </div>
  );
}

/**
 * Title (the page's h1) and description. With `focusTitle` the title takes keyboard focus on
 * mount: use it on screens reached by a state change so keyboard and screen reader users land on
 * the new content.
 */
export function AuthHeader({
  title,
  description,
  step,
  focusTitle = false,
}: {
  title: string;
  description?: ReactNode;
  /** "Step 1 of 2" pill (accept invite). */
  step?: string;
  focusTitle?: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusTitle) ref.current?.focus();
  }, [focusTitle]);
  return (
    <header className="flex flex-col items-start gap-3 [word-break:break-word]">
      {step ? (
        <span className="rounded-full border border-border-soft bg-bg-base px-2 py-0.5 font-medium text-[12px] text-text-secondary leading-4">
          {step}
        </span>
      ) : null}
      <h1
        ref={ref}
        tabIndex={-1}
        className="font-semibold text-[24px] text-text leading-8 tracking-[-0.24px] outline-none"
      >
        {title}
      </h1>
      {description ? (
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          {description}
        </p>
      ) : null}
    </header>
  );
}

/** Grey info row with an icon (Figma "Try again at 14:35", "Invite expires in 2 days"). */
export function InfoRow({
  icon = "clock",
  children,
}: {
  icon?: "clock" | "mail";
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-bg-fill2 px-3 py-2 text-[14px] text-text leading-5 tracking-[-0.14px]">
      {icon === "clock" ? <ClockIcon size={16} className="shrink-0" /> : null}
      {icon === "mail" ? <MailGlyph /> : null}
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

function MailGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

/** Hairline with a line of help text under it ("Trouble signing in? Contact a Super admin"). */
export function AuthFooterNote({ children }: { children: ReactNode }) {
  return (
    <div className="border-border-soft border-t pt-4 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
      {children}
    </div>
  );
}
