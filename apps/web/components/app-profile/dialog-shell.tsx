"use client";

import { type ReactNode, useId, useRef } from "react";
import { useModalSurface } from "../app/hooks";
import { FOCUS } from "../app/ui";
import { XIcon } from "../auth/icons";

/**
 * The frame of the profile dialogs (Figma "Edit profile dialog", "Make your profile public
 * dialog"): a centred 560px dialog from md up, a full-height sheet on phones. Modal behaviour:
 * focus moves in and is trapped, Escape and a click on the scrim close it, the page behind does
 * not scroll, and focus goes back to the button that opened it (useModalSurface).
 */
export function DialogShell({
  icon,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useModalSurface(panelRef, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center md:items-center md:p-6">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-static-black/60 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative flex w-full flex-col overflow-hidden bg-bg-base md:max-h-full md:max-w-[560px] md:rounded-3xl md:border md:border-border md:shadow-card"
      >
        <div className="flex shrink-0 items-start gap-4 border-border-soft border-b border-dashed p-5 md:px-8 md:pt-8 md:pb-6">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border border-dashed bg-bg-fill1 text-text-secondary"
          >
            {icon}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2
              id={titleId}
              className="font-medium text-[18px] text-text leading-7 tracking-[-0.18px]"
            >
              {title}
            </h2>
            <p
              id={descriptionId}
              className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]"
            >
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`flex size-8 shrink-0 items-center justify-center rounded-md bg-bg-fill1 text-text-secondary hover:text-text ${FOCUS}`}
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 md:px-8 md:pt-6 md:pb-6">
          {children}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-border-soft border-t p-4 md:border-t-0 md:px-8 md:pt-0 md:pb-8">
          {footer}
        </div>
      </div>
    </div>
  );
}
