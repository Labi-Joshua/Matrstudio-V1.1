"use client";

import { type RefObject, useEffect, useId, useRef } from "react";
import { resourceHost } from "../../lib/app/detail-state";
import type { LibraryItem } from "../../lib/app/library-data";
import { CloseIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { ExternalIcon } from "./art";
import { BTN_SECONDARY } from "./ui";

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

/**
 * The article "reading window" (Figma "Resource: article, reading window open", desktop and
 * tablet): a browser-style window floating over the page. It is a modal dialog: focus moves in and
 * is trapped, Esc, the close button and a click on the dim background close it, and the page does
 * not scroll behind it. Publishers' sites cannot be framed inside the app (their own rules and the
 * app's content security policy), so the window states that plainly and offers the real page in a
 * new tab instead of drawing placeholder text.
 */
export function ReadingWindow({
  item,
  url,
  returnFocusTo,
  onClose,
  onOpenTab,
}: {
  item: LibraryItem;
  url: string;
  /** The button that opened the window; it gets focus back on close. */
  returnFocusTo: RefObject<HTMLElement | null>;
  onClose: () => void;
  onOpenTab: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const trigger = returnFocusTo.current;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
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
  }, [onClose, returnFocusTo]);

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-static-black/40 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute top-24 right-4 flex max-h-[calc(100dvh-7rem)] w-[min(620px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border-soft bg-bg-base shadow-e2 md:right-10"
      >
        <div className="flex items-center gap-3 border-border-soft border-b bg-bg-fill2 px-4 py-3">
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
          </span>
          <p className="min-w-0 flex-1 truncate rounded-md bg-bg-base px-3 py-1 text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
            {resourceHost(url)}
          </p>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close reading window"
            onClick={onClose}
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-fill1 hover:text-text ${FOCUS}`}
          >
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-6">
          <h2
            id={titleId}
            className="break-words font-medium text-[28px] text-text leading-9 tracking-[-0.56px]"
          >
            {item.title}
          </h2>
          <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
            {item.sourceName} · {item.lengthLabel}
          </p>
          <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">
            {item.sourceName} doesn’t let other sites show its pages inside a window, so the article
            opens on its own site. Open it in a new tab, read it there, then come back here.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onOpenTab}
              className={BTN_SECONDARY}
            >
              <ExternalIcon size={16} />
              Open in new tab
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <button type="button" onClick={onClose} className={BTN_SECONDARY}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
