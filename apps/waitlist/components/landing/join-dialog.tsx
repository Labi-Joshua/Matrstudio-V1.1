"use client";

import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { WaitlistForm } from "../waitlist-form";
import { Badge } from "./primitives";

/** Fired by JoinDialogTrigger; detail.source records which button opened the modal. */
const OPEN_EVENT = "matr:open-join-dialog";

type OpenDetail = { source: string };

/**
 * Button that opens the shared waitlist modal. Use it anywhere (navbar, CTA); the page renders a
 * single <JoinDialog /> so there is one form and one set of ids.
 */
export function JoinDialogTrigger({
  source,
  className,
  children,
}: {
  /** Saved with the signup so we can tell which button converted. */
  source: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className={className}
      onClick={() =>
        window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail: { source } }))
      }
    >
      {children}
    </button>
  );
}

/**
 * The waitlist modal, rendered once per page. Native <dialog>: showModal() traps focus, Esc
 * closes it, and ::backdrop dims the page.
 */
export function JoinDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState("waitlist-modal");

  useEffect(() => {
    const onOpen = (event: Event) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      setSource((event as CustomEvent<OpenDetail>).detail?.source ?? "waitlist-modal");
      if (!dialog.open) dialog.showModal();
      dialog.querySelector<HTMLInputElement>("input[type=email]")?.focus();
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  function close() {
    dialogRef.current?.close();
  }

  // A click whose target is the <dialog> itself landed on the backdrop, outside the panel.
  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) close();
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc already closes a modal <dialog> natively
    <dialog
      ref={dialogRef}
      aria-labelledby="join-dialog-title"
      onClick={onBackdropClick}
      className="m-auto w-[calc(100%-32px)] max-w-[440px] rounded-2xl border border-border-alpha bg-bg-base p-0 text-text shadow-card backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
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
        {/* Stable id: the source only changes the metadata sent with the signup. */}
        <WaitlistForm
          variant="primary"
          source={source}
          inputId="email-join-dialog"
          fluid
          className="mt-2 w-full items-center"
        />
      </div>
    </dialog>
  );
}
