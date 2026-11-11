"use client";

import { type FormEvent, type ReactNode, useId, useRef } from "react";
import { useModalSurface } from "../../lib/super/hooks";
import { Button } from "./ui";

/**
 * The shared modal (Figma: scrim, 600px card, icon badge + title + subtitle, dashed divider, body,
 * footer with two buttons). Centred from 640px, a bottom sheet on phones. Esc closes it unless
 * `busy`; focus is trapped and returns to the opener (useModalSurface).
 */
export function Modal({
  icon,
  tone = "neutral",
  title,
  subtitle,
  onClose,
  busy = false,
  children,
  footer,
  onSubmit,
  width = 520,
}: {
  icon: ReactNode;
  tone?: "neutral" | "danger";
  title: string;
  subtitle?: string;
  onClose: () => void;
  busy?: boolean;
  children?: ReactNode;
  footer: ReactNode;
  onSubmit?: () => void;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useModalSurface(ref, () => {
    if (!busy) onClose();
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy) onSubmit?.();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
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
        aria-describedby={subtitle ? descId : undefined}
        style={{ maxWidth: width }}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-3xl bg-bg-elevation-1 p-5 shadow-card sm:rounded-3xl sm:p-6"
      >
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex items-start gap-3">
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-full border ${
                tone === "danger"
                  ? "border-error-focus bg-error-accent text-error-text"
                  : "border-border-soft bg-bg-fill1 text-text-secondary"
              }`}
            >
              {icon}
            </span>
            <div className="min-w-0 pt-0.5">
              <h2
                id={titleId}
                className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px]"
              >
                {title}
              </h2>
              {subtitle ? (
                <p
                  id={descId}
                  className="text-[13px] text-text-tertiary leading-[18px] tracking-[-0.13px]"
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <div className="border-border border-t border-dashed" />
          {children}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
        </form>
      </div>
    </div>
  );
}

/** Cancel + confirm footer. `submit` makes the confirm button the form's submit button. */
export function ModalFooter({
  onCancel,
  confirmLabel,
  busyLabel,
  busy,
  disabled,
  kind = "primary",
}: {
  onCancel: () => void;
  confirmLabel: string;
  busyLabel?: string;
  busy: boolean;
  disabled?: boolean;
  kind?: "primary" | "danger";
}) {
  return (
    <>
      <Button onClick={onCancel} disabled={busy} className="sm:min-w-20">
        Cancel
      </Button>
      <Button type="submit" kind={kind} disabled={busy || disabled} aria-busy={busy}>
        {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
      </Button>
    </>
  );
}

/** Grey inset box used for body groups in the modals. */
export function Inset({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-2xl bg-bg-fill1 p-4">{children}</div>;
}

export function InlineError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-[13px] text-error-text leading-[18px]">
      {children}
    </p>
  );
}
