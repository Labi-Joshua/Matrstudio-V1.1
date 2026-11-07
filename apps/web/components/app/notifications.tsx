"use client";

import { useId } from "react";
import { usePopover } from "./hooks";
import { BellIcon, CloseIcon, InboxIcon } from "./icons";
import { FOCUS } from "./ui";

/**
 * Bell and notifications panel (Figma "Notifications panel" 420 wide on desktop, full screen on
 * phones). There is no notifications API yet, so the panel only ever shows the designed
 * "You're all caught up" state, and the bell never shows an unread dot: nothing here is invented.
 * "Mark all as read" is left out until there is something to mark.
 */
export function NotificationsBell() {
  const { open, toggle, close, buttonRef, panelRef } = usePopover();
  const panelId = useId();
  const titleId = useId();

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={`flex size-10 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary hover:text-text ${FOCUS}`}
      >
        <BellIcon size={20} />
      </button>
      {open ? (
        <section
          id={panelId}
          ref={panelRef}
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg-base md:absolute md:inset-auto md:top-full md:right-0 md:mt-2 md:w-[420px] md:max-w-[calc(100vw-2rem)] md:rounded-2xl md:border md:border-border-soft md:shadow-card"
        >
          <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
            <h2
              id={titleId}
              className="flex-1 font-semibold text-[20px] text-text leading-7 tracking-[-0.2px]"
            >
              Notifications
            </h2>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={close}
              className={`flex size-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-fill1 hover:text-text md:hidden ${FOCUS}`}
            >
              <CloseIcon size={20} />
            </button>
          </div>
          <div className="flex flex-col items-center gap-3.5 px-4 py-10 text-center">
            <span
              aria-hidden="true"
              className="flex size-16 items-center justify-center rounded-full border-[1.5px] border-border border-dashed bg-bg-fill1 text-text-secondary"
            >
              <InboxIcon size={28} />
            </span>
            <p className="font-semibold text-[22px] text-text leading-8 tracking-[-0.22px]">
              You’re all caught up
            </p>
            <p className="max-w-[340px] text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              We’ll let you know when a curator replies or a path you’re on changes.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
