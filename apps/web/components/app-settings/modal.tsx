"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { trapTarget } from "../../lib/app/submit-dialog";
import { FOCUS } from "../app/ui";
import { XIcon } from "../auth/icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The Settings dialogs (Figma "Settings: delete account" dialog and sheet): a centred card from
 * md up, a full-screen sheet with a plain "X  Title" header on phones. Modal behaviour: focus
 * moves in and is trapped, Escape and a click on the scrim close it (unless `busy`, so a request
 * in flight is never abandoned), page scroll is locked, and focus returns to the trigger.
 */
export function Modal({
  title,
  subtitle,
  icon,
  onClose,
  busy = false,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  onClose: () => void;
  busy?: boolean;
  footer: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus], input, select, textarea");
    (first ?? panel)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const active = items.indexOf(document.activeElement as HTMLElement);
      const target = trapTarget(items.length, active, event.shiftKey);
      if (target === null) return;
      event.preventDefault();
      items[target]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center md:items-center md:p-6">
      <div
        aria-hidden="true"
        onClick={() => {
          if (!busy) onClose();
        }}
        className="absolute inset-0 bg-static-black/60"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex w-full flex-col overflow-hidden bg-bg-base outline-none md:max-h-full md:max-w-[520px] md:rounded-3xl md:border md:border-border md:shadow-card"
      >
        <div className="flex shrink-0 items-center gap-3 border-border-soft border-b p-4 md:items-start md:gap-4 md:border-dashed md:px-8 md:pt-8 md:pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className={`flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:text-text md:order-last md:bg-bg-fill1 ${FOCUS}`}
          >
            <XIcon size={16} />
          </button>
          <span
            aria-hidden="true"
            className="hidden size-14 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border border-dashed bg-bg-fill1 text-text-secondary md:flex"
          >
            {icon}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2
              id={titleId}
              className="font-medium text-[18px] text-text leading-7 tracking-[-0.18px]"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="hidden text-[14px] text-text-tertiary leading-5 tracking-[-0.14px] md:block">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 md:px-8 md:pt-6 md:pb-6">
          {children}
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-border-soft border-t p-4 md:flex-row md:justify-end md:border-0 md:px-8 md:pt-0 md:pb-8">
          {footer}
        </div>
      </div>
    </div>
  );
}
