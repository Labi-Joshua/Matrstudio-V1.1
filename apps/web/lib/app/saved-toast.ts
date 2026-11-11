import type { ApiErrorCode } from "../auth/api";

/**
 * The words and timing of the bookmark toasts (Figma "Saved: bookmarked from a card", "removed,
 * with undo", "couldn't save"). Pure, so the copy is testable; components/app-saved/saved-toast.tsx
 * draws it and the provider decides what each action does.
 */
export type SavedToastAction = "view-saved" | "undo" | "retry" | null;

export type SavedToastModel = {
  tone: "success" | "info" | "error";
  title: string;
  body: string;
  action: SavedToastAction;
  /** Milliseconds until it dismisses itself. */
  duration: number;
};

export type SavedOp = "save" | "remove" | "load";

const SHORT_MS = 6000;
const LONG_MS = 8000;
const MAX_TITLE = 60;

const clip = (text: string) =>
  text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1)}…` : text;

export const savedToast = (): SavedToastModel => ({
  tone: "success",
  title: "Saved to your library",
  body: "Find it any time in Saved.",
  action: "view-saved",
  duration: SHORT_MS,
});

export const removedToast = (title: string | undefined): SavedToastModel => ({
  tone: "info",
  title: "Removed from Saved",
  body: title ? `“${clip(title)}” is no longer saved.` : "It is no longer saved.",
  action: "undo",
  duration: LONG_MS,
});

/** What went wrong, in plain words; Retry only where trying again straight away can work. */
export function failureToast(code: ApiErrorCode, op: SavedOp): SavedToastModel {
  const base = { tone: "error" as const, duration: LONG_MS };
  const verb = op === "remove" ? "remove" : "save";
  if (code === "saved_limit") {
    return {
      ...base,
      title: "Your saved list is full",
      body: "You can save up to 500 resources. Remove one to save another.",
      action: null,
    };
  }
  if (code === "rate_limited") {
    return {
      ...base,
      title: "Too many changes just now",
      body: "Wait a few minutes, then try again.",
      action: null,
    };
  }
  if (code === "unauthorized") {
    return {
      ...base,
      title: "You’ve been signed out",
      body: "Sign in again to save resources.",
      action: null,
    };
  }
  if (op === "load") {
    return {
      ...base,
      title: "Couldn’t load your saved list",
      body: "Check your connection and try again.",
      action: "retry",
    };
  }
  return {
    ...base,
    title: `Couldn’t ${verb} that`,
    body:
      code === "network_error"
        ? "Check your connection and try again."
        : `Something went wrong. Try ${op === "remove" ? "removing" : "saving"} it again.`,
    action: "retry",
  };
}

/** The label a bookmark control gets: its own accessible name, naming the resource. */
export const bookmarkLabel = (title: string, saved: boolean) =>
  saved ? `Remove ${title} from saved` : `Save ${title}`;
