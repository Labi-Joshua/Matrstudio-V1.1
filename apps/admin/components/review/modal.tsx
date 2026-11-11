"use client";

import { type ReactNode, useId, useRef } from "react";
import { useModalSurface } from "./hooks";

/**
 * The modal pattern from the design: scrim, 600px panel, icon badge with title and subtitle, a
 * dashed divider, body, footer. Focus trap, Escape, scroll lock and focus return come from
 * useModalSurface. A press on the scrim closes it unless `busy`.
 */
export function Modal({
  icon,
  tone = "neutral",
  title,
  subtitle,
  onClose,
  busy = false,
  footer,
  children,
}: {
  icon: ReactNode;
  tone?: "neutral" | "danger";
  title: string;
  subtitle?: string;
  onClose: () => void;
  busy?: boolean;
  footer: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  useModalSurface(ref, () => {
    if (!busy) onClose();
  });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        onClick={() => {
          if (!busy) onClose();
        }}
        className="absolute inset-0 cursor-default bg-static-black/60 backdrop-blur-sm"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        className="relative flex max-h-[92dvh] w-full max-w-[600px] flex-col overflow-y-auto rounded-t-3xl bg-bg-base p-6 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start gap-4">
          <span
            className={`flex size-12 shrink-0 items-center justify-center rounded-full border border-dashed ${tone === "danger" ? "border-error-border bg-error-accent text-error-text" : "border-border bg-bg-fill1 text-text-secondary"}`}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="font-medium text-[18px] text-text leading-6">
              {title}
            </h2>
            {subtitle ? (
              <p id={subtitleId} className="mt-0.5 text-[13px] text-text-tertiary">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="my-5 border-border border-t border-dashed" />
        <div className="flex flex-col gap-4">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}
