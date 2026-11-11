import type { ApiErrorCode } from "../auth/api";
import { lessonsDoneText } from "./progress-logic";
import type { SavedToastModel } from "./saved-toast";

/**
 * The words and timing of the progress toasts (Figma "Path started", "Marked done", "Lesson:
 * couldn't mark as done"). Pure, so the copy is testable. The model is the one the shared toast
 * host in components/app-saved/saved-toast.tsx draws (its "view-saved" action is never used here).
 */
export type ProgressOp = "start" | "done" | "undo" | "star" | "unstar" | "load";

const SHORT_MS = 6000;
const LONG_MS = 8000;

export const startedToast = (): SavedToastModel => ({
  tone: "success",
  title: "Path started",
  body: "It’s in Your paths. Lesson 1 is ready when you are.",
  action: null,
  duration: SHORT_MS,
});

export const lessonDoneToast = (
  lessonNumber: number | null,
  done: number,
  total: number,
): SavedToastModel => ({
  tone: "success",
  title: lessonNumber ? `Lesson ${lessonNumber} done` : "Lesson done",
  body: `${lessonsDoneText(done, total)}. Nice work.`,
  action: "undo",
  duration: SHORT_MS,
});

export const lessonUndoneToast = (lessonNumber: number | null): SavedToastModel => ({
  tone: "info",
  title: lessonNumber ? `Lesson ${lessonNumber} is open again` : "Lesson is open again",
  body: "It no longer counts as done.",
  action: null,
  duration: SHORT_MS,
});

/** What went wrong, in plain words; Retry only where trying again straight away can work. */
export function failureToast(code: ApiErrorCode, op: ProgressOp): SavedToastModel {
  const base = { tone: "error" as const, duration: LONG_MS };
  if (code === "path_limit") {
    return {
      ...base,
      title: "You follow a lot of paths",
      body: "You can start or star up to 200 paths. Unstar one to add another.",
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
      body: "Sign in again to keep your progress.",
      action: null,
    };
  }
  if (op === "load") {
    return {
      ...base,
      title: "Couldn’t load your paths",
      body: "Check your connection and try again.",
      action: "retry",
    };
  }
  if (op === "done") {
    // Figma "Lesson: couldn’t mark as done": the lesson page keeps its Mark as done button.
    return {
      ...base,
      title: "Your progress didn’t save",
      body: "Check your connection, then tap Mark as done again.",
      action: null,
    };
  }
  const what: Record<Exclude<ProgressOp, "load" | "done">, string> = {
    start: "start that path",
    undo: "undo that",
    star: "star that path",
    unstar: "unstar that path",
  };
  return {
    ...base,
    title: `Couldn’t ${what[op]}`,
    body:
      code === "network_error"
        ? "Check your connection and try again."
        : "Something went wrong. Try again in a moment.",
    action: "retry",
  };
}
