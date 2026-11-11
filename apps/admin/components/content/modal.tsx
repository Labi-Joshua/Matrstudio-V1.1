"use client";

import { type ReactNode, useId, useRef } from "react";
import { useModalSurface } from "./hooks";
import { Button } from "./ui";

/**
 * Modal pattern from the design: scrim, 600px card, icon badge + title + subtitle, dashed divider,
 * body, footer buttons. Focus trap, Escape, scroll lock and focus return come from
 * useModalSurface. `busy` blocks Escape and the scrim so an in-flight save is not abandoned.
 */
export function Modal({
  title,
  subtitle,
  icon,
  tone = "neutral",
  onClose,
  busy = false,
  width = 600,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  icon: ReactNode;
  tone?: "neutral" | "danger";
  onClose: () => void;
  busy?: boolean;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = () => {
    if (!busy) onClose();
  };
  useModalSurface(ref, close);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 cursor-default bg-static-black/60 backdrop-blur-sm"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: width }}
        className="relative flex max-h-[calc(100dvh-24px)] w-full flex-col rounded-t-3xl bg-bg-base p-6 shadow-card sm:max-h-[calc(100dvh-48px)] sm:rounded-3xl"
      >
        <div className="flex items-start gap-4">
          <span
            className={`flex size-12 shrink-0 items-center justify-center rounded-full border border-dashed ${
              tone === "danger"
                ? "border-error-border bg-error-accent text-error-text"
                : "border-border bg-bg-fill1 text-text-secondary"
            }`}
          >
            {icon}
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id={titleId} className="font-medium text-[16px] leading-6 tracking-[-0.16px]">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <hr className="my-5 border-0 border-border border-t border-dashed" />
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Cancel + primary pair used by most modals. */
export function ModalActions({
  onCancel,
  cancelLabel = "Cancel",
  confirmLabel,
  onConfirm,
  busy,
  disabled,
  danger,
}: {
  onCancel: () => void;
  cancelLabel?: string;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <>
      <Button onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </Button>
      <Button
        kind={danger ? "danger" : "primary"}
        onClick={onConfirm}
        busy={busy}
        disabled={disabled}
      >
        {confirmLabel}
      </Button>
    </>
  );
}
