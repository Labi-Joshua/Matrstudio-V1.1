"use client";

import { type ReactNode, useId, useRef } from "react";
import { useModalSurface } from "./hooks";
import { CloseIcon } from "./icons";

/**
 * The modal pattern of the design: scrim (bg-static-black/60 + blur), a panel with an icon badge,
 * title and subtitle, a dashed divider, the body and a footer. Focus is trapped, Esc closes, the
 * page behind does not scroll and focus returns to the opener (useModalSurface). Pass the footer
 * buttons as `footer`. `width` is the panel width in px on desktop (design: 600).
 */
export function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  width = 600,
  dismissible = true,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** False blocks Esc, the scrim and the close button (a request is in flight). */
  dismissible?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = () => {
    if (dismissible) onClose();
  };
  useModalSurface(panelRef, close);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-6">
      <div
        aria-hidden="true"
        onClick={close}
        className="absolute inset-0 bg-static-black/60 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: width }}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border-soft bg-bg-base shadow-e2 md:rounded-2xl"
      >
        <header className="flex items-start gap-3 px-5 pt-5 pb-4 md:px-6">
          {icon ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-bg-fill1 text-text">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="font-semibold text-[18px] text-text leading-6 tracking-[-0.18px]"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            aria-disabled={!dismissible || undefined}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-fill2 hover:text-text focus-visible:outline-2 focus-visible:outline-primary-border"
          >
            <CloseIcon size={18} />
          </button>
        </header>
        <div aria-hidden="true" className="mx-5 border-border border-t border-dashed md:mx-6" />
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6">
          {children}
        </div>
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-border-soft border-t px-5 py-4 md:flex-row md:justify-end md:px-6 [&>*]:md:w-auto [&>*]:md:min-w-28">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
