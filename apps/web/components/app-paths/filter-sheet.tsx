"use client";

import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { CloseIcon } from "../app/icons";
import { FOCUS } from "../app/ui";

/**
 * A bottom sheet for phones: a modal dialog over a scrim. Focus moves in and is trapped, Esc and a
 * press on the scrim close it, page scroll is locked while it is open, and focus goes back to the
 * trigger on close.
 */
export function BottomSheet({
  id,
  title,
  onClose,
  returnFocusTo,
  children,
  footer,
}: {
  id: string;
  title: string;
  onClose: () => void;
  returnFocusTo: RefObject<HTMLElement | null>;
  children: ReactNode;
  footer: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    const trigger = returnFocusTo.current;
    const target =
      panel?.querySelector<HTMLElement>("input:checked") ??
      panel?.querySelector<HTMLElement>("button");
    target?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [returnFocusTo]);

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-static-black/60 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="relative flex max-h-[85dvh] w-full flex-col gap-4 rounded-t-3xl border-border-soft border-t bg-bg-base px-5 pt-4 pb-5 shadow-e2"
      >
        <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-bg-fill2" />
        <div className="flex items-center justify-between">
          <h2 id={id} className="font-semibold text-[18px] text-text leading-7 tracking-[-0.18px]">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`flex size-10 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary hover:text-text ${FOCUS}`}
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <div className="flex gap-2.5">{footer}</div>
      </div>
    </div>
  );
}
