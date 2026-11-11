"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedToastModel } from "../../lib/app/saved-toast";
import { ROUTES } from "../../lib/routes";
import { Banner, bannerActionClasses, ToastRegion } from "../auth/banner";

/** A toast on screen. `key` changes with every toast, so a new one restarts the timer. */
export type ShownToast = {
  key: number;
  model: SavedToastModel;
  /** What the Undo or Retry button does. */
  run?: () => void;
};

const BUTTON_LABEL = { undo: "Undo", retry: "Retry" } as const;

/**
 * The one toast host for bookmarking: top centre (ToastRegion), a new toast replaces the one
 * showing. It dismisses itself after `model.duration`, but not while the pointer is over it or
 * focus is inside, so Undo and Retry can always be reached. The region itself is always in the
 * page, so screen readers announce what appears in it.
 */
export function SavedToastHost({
  toast,
  onDismiss,
}: {
  toast: ShownToast | null;
  onDismiss: () => void;
}) {
  // The key of the toast being held; a new toast has a new key, so it starts unheld.
  const [heldKey, setHeldKey] = useState<number | null>(null);
  const key = toast?.key;
  const held = key !== undefined && heldKey === key;
  const duration = toast?.model.duration;

  useEffect(() => {
    if (key === undefined || duration === undefined || held) return;
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [key, duration, held, onDismiss]);

  const model = toast?.model;
  return (
    <ToastRegion>
      {toast && model ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: only pauses the auto-dismiss timer; the controls inside are real buttons
        <div
          key={toast.key}
          onPointerEnter={() => setHeldKey(toast.key)}
          onPointerLeave={() => setHeldKey(null)}
          onFocus={() => setHeldKey(toast.key)}
          onBlur={() => setHeldKey(null)}
        >
          <Banner
            tone={model.tone}
            title={model.title}
            onDismiss={onDismiss}
            action={
              model.action === "view-saved" ? (
                <Link href={ROUTES.app.saved} onClick={onDismiss} className={bannerActionClasses}>
                  View saved
                </Link>
              ) : model.action ? (
                <button
                  type="button"
                  className={bannerActionClasses}
                  onClick={() => {
                    onDismiss();
                    toast.run?.();
                  }}
                >
                  {BUTTON_LABEL[model.action]}
                </button>
              ) : undefined
            }
          >
            {model.body}
          </Banner>
        </div>
      ) : null}
    </ToastRegion>
  );
}
