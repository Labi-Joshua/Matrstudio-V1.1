"use client";

import { useEffect, useState } from "react";
import { STAR_HINT, STARRED_HINT, starToastCopy } from "../../lib/app/paths-state";
import { FOCUS } from "../app/ui";
import { StarIcon } from "./icons";
import { Toast } from "./parts";

/**
 * "Star path" / "Starred" next to Start path (Figma 5 and 6): the secondary button, its hint and,
 * after starring, the "Saved to Your paths" toast. The path page passes the real handler
 * (usePaths().toggleStar); the toast hides again if the API refuses and the star rolls back.
 */

const TOAST_MS = 6000;

export function StarAction({
  starred,
  onToggle,
  disabled = false,
  hint,
}: {
  starred: boolean;
  onToggle: () => void;
  /** A request for this path is in flight. */
  disabled?: boolean;
  /** Replaces the default hint (the path page shows its progress line there once started). */
  hint?: string | null;
}) {
  return (
    <>
      <button
        type="button"
        aria-pressed={starred}
        disabled={disabled}
        onClick={onToggle}
        className={`inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border px-3 font-medium text-[16px] leading-6 tracking-[-0.16px] sm:w-auto disabled:opacity-60 ${FOCUS} ${
          starred
            ? "border-transparent bg-primary-accent text-primary-text"
            : "border-border bg-bg-elevation-1 text-text shadow-e1"
        }`}
      >
        <StarIcon size={18} fill={starred ? "currentColor" : "none"} />
        {starred ? "Starred" : "Star path"}
      </button>
      {hint === null ? null : (
        <p className="text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]">
          {hint ?? (starred ? STARRED_HINT : STAR_HINT)}
        </p>
      )}
    </>
  );
}

/** The star controls with their toast: it shows when a path becomes starred and dismisses itself. */
export function StarControls({
  title,
  starred,
  onToggle,
  disabled,
  hint,
}: {
  title: string;
  starred: boolean;
  onToggle: () => void;
  disabled?: boolean;
  hint?: string | null;
}) {
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);
  const copy = starToastCopy(title);
  return (
    <>
      <StarAction
        starred={starred}
        disabled={disabled}
        hint={hint}
        onToggle={() => {
          setToast(!starred);
          onToggle();
        }}
      />
      {toast && starred ? (
        <Toast title={copy.title} body={copy.body} onClose={() => setToast(false)} />
      ) : null}
    </>
  );
}
