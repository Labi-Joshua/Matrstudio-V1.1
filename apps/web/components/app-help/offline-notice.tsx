"use client";

import { useState } from "react";
import { bannerActionClasses } from "../auth/banner";
import { ClockAlertIcon } from "../auth/icons";
import { useOnline } from "./use-online";

/**
 * Figma "Help centre: offline": an amber strip above the page. Pages already loaded stay readable,
 * but sending a message or reply needs a connection, and the copy says so. "Try again" re-reads
 * the connection flag; if it is still off the strip says so.
 */
export function OfflineNotice() {
  const { online, recheck } = useOnline();
  const [stillOffline, setStillOffline] = useState(false);

  return (
    <div role="status" aria-live="polite">
      {online ? null : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-warning-focus px-4 py-3 text-[14px] text-warning-text leading-5 tracking-[-0.14px]">
          <ClockAlertIcon size={20} className="shrink-0" />
          <p className="min-w-0 flex-1 basis-56">
            {stillOffline
              ? "Still offline. We’ll check again when your connection returns."
              : "You’re offline. You can still read this page, but sending a message needs a connection."}
          </p>
          <button
            type="button"
            onClick={() => setStillOffline(!recheck())}
            className={bannerActionClasses}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
