"use client";

import { type MouseEvent, useRef } from "react";
import { WaitlistForm } from "../waitlist-form";
import { Badge } from "./primitives";

/**
 * "Be a part of the community" button that opens the waitlist form in a modal.
 * Native <dialog>: showModal() traps focus, Esc closes it, and ::backdrop dims the page.
 */
export function JoinDialog({ className }: { className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function open() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>("input[type=email]")?.focus();
  }

  function close() {
    dialogRef.current?.close();
  }

  // A click whose target is the <dialog> itself landed on the backdrop, outside the panel.
  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) close();
  }

  return (
    <>
      <button type="button" onClick={open} aria-haspopup="dialog" className={className}>
        Be a part of the community
      </button>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc already closes a modal <dialog> natively */}
      <dialog
        ref={dialogRef}
        aria-labelledby="join-dialog-title"
        onClick={onBackdropClick}
        className="m-auto w-[calc(100%-32px)] max-w-[440px] rounded-2xl border border-border-alpha bg-bg-base p-0 text-text shadow-card backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="relative flex flex-col items-center gap-4 px-6 pt-8 pb-6 text-center sm:px-8">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-bg-fill1 hover:text-text"
          >
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <Badge tone="primary">Join Us</Badge>
          <h2
            id="join-dialog-title"
            className="font-display font-medium text-2xl text-text leading-8 tracking-[-0.48px]"
          >
            Join the waitlist
          </h2>
          <p className="text-sm text-text-secondary leading-[21px] tracking-[-0.14px]">
            Secure your spot in the early access queue. We&apos;ll email you a link to confirm.
          </p>
          <WaitlistForm
            variant="primary"
            source="waitlist-cta"
            fluid
            className="mt-2 w-full items-center"
          />
        </div>
      </dialog>
    </>
  );
}
