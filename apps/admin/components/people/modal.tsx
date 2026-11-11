"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { FOCUS, Icon, PATHS } from "./ui";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog from the Figma modals: 600px card, icon badge, title and subtitle, dashed divider, body,
 * footer. Full-screen sheet on phones. Focus moves in and is trapped, Escape and a click on the
 * scrim close it (not while `busy`), page scroll is locked, focus returns to the opener.
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
  icon: string;
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
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
      if (items.length === 0) return;
      const at = items.indexOf(document.activeElement as HTMLElement);
      const last = items.length - 1;
      if (event.shiftKey && at <= 0) {
        event.preventDefault();
        items[last]?.focus();
      } else if (!event.shiftKey && at === last) {
        event.preventDefault();
        items[0]?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center md:items-center md:p-6">
      <div
        aria-hidden="true"
        onClick={() => {
          if (!busy) onClose();
        }}
        className="absolute inset-0 bg-static-black/60 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex w-full flex-col overflow-hidden bg-bg-base outline-none md:max-h-full md:max-w-[600px] md:rounded-3xl md:border md:border-border md:shadow-card"
      >
        <div className="flex shrink-0 items-center gap-3 border-border-soft border-b p-4 md:items-start md:gap-4 md:border-dashed md:px-8 md:pt-8 md:pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className={`flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:text-text md:order-last md:bg-bg-fill1 ${FOCUS}`}
          >
            <Icon d={PATHS.x} />
          </button>
          <span
            aria-hidden="true"
            className="hidden size-14 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border border-dashed bg-bg-fill1 text-text-secondary md:flex"
          >
            <Icon d={icon} size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2
              id={titleId}
              className="font-medium text-[18px] text-text leading-7 tracking-[-0.18px]"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="text-[14px] text-text-tertiary leading-5 tracking-[-0.14px] max-md:hidden">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 md:px-8 md:pt-6 md:pb-6">
          {subtitle ? (
            <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px] md:hidden">
              {subtitle}
            </p>
          ) : null}
          {children}
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-border-soft border-t p-4 md:flex-row md:justify-end md:border-0 md:px-8 md:pt-0 md:pb-8">
          {footer}
        </div>
      </div>
    </div>
  );
}

/** Grey note row at the foot of a modal ("Logged in the audit log with your name and the reason."). */
export function ModalNote({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-bg-fill1 px-3 py-2.5 text-[13px] text-text-secondary leading-5 tracking-[-0.13px]">
      <span className="shrink-0">
        <Icon d={icon} />
      </span>
      {children}
    </p>
  );
}
