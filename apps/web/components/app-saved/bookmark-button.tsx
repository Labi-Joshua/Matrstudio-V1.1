"use client";

import { bookmarkLabel } from "../../lib/app/saved-toast";
import { BookmarkIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { useSaved } from "./saved-provider";

/**
 * The bookmark on a resource card (Figma "Resource Card": 18px bookmark beside the open-source
 * arrow, orange and filled once saved). It sits above the card's stretched link (z-10), so tapping
 * it never opens the resource. Its name says which resource it is for, and aria-pressed carries
 * the saved state. Until the saved list has loaded the button waits (aria-disabled) rather than
 * guess; while its own request is in flight it ignores taps.
 */
export function BookmarkButton({ id, title }: { id: string; title: string }) {
  const { status, isSaved, isPending, toggle } = useSaved();
  const saved = isSaved(id);
  const loading = status === "loading";
  const waiting = loading || isPending(id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={bookmarkLabel(title, saved)}
      aria-disabled={waiting || undefined}
      onClick={() => {
        if (!waiting) toggle(id);
      }}
      className={`relative z-10 flex items-center justify-center rounded-md p-[7px] hover:bg-bg-fill1 ${FOCUS} ${
        saved ? "text-primary-text" : "text-text-secondary hover:text-text"
      } ${loading ? "cursor-progress opacity-60" : ""}`}
    >
      <BookmarkIcon size={18} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
