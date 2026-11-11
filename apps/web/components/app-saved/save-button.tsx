"use client";

import { bookmarkLabel } from "../../lib/app/saved-toast";
import { BookmarkIcon } from "../app/icons";
import { BTN_SECONDARY } from "../app-library/ui";
import { useSaved } from "./saved-provider";

const SAVED_BTN =
  "btn-lift group inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-primary-border bg-primary-accent px-3 font-medium text-[14px] text-primary-text leading-5 tracking-[-0.14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border";

/**
 * Save button in the resource page's actions row (Figma "Resource: saved"): "Save" until the
 * resource is bookmarked, then an orange "Saved" that reads "Remove" under the pointer or keyboard
 * focus and removes it (with the Undo toast) when pressed. Its accessible name always says what
 * pressing it does and for which resource.
 */
export function SaveButton({ id, title }: { id: string; title: string }) {
  const { status, isSaved, isPending, toggle } = useSaved();
  const saved = isSaved(id);
  const waiting = status === "loading" || isPending(id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={bookmarkLabel(title, saved)}
      aria-disabled={waiting || undefined}
      onClick={() => {
        if (!waiting) toggle(id);
      }}
      className={`${saved ? SAVED_BTN : BTN_SECONDARY} w-full md:w-auto ${
        status === "loading" ? "cursor-progress opacity-60" : ""
      }`}
    >
      <BookmarkIcon size={16} fill={saved ? "currentColor" : "none"} />
      {saved ? (
        <>
          <span className="group-hover:hidden group-focus-visible:hidden">Saved</span>
          <span className="hidden group-hover:inline group-focus-visible:inline">Remove</span>
        </>
      ) : (
        "Save"
      )}
    </button>
  );
}
