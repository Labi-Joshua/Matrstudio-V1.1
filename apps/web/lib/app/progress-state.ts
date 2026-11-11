import type { PathProgress } from "../auth/progress-api";
import { isBlank, sortEntries } from "./progress-logic";

/**
 * Pure state behind path progress: the learner's started and starred paths, most recent first,
 * with optimistic changes that roll back when the API refuses. The provider
 * (components/app-progress/progress-provider.tsx) wires this reducer to the API and the toasts.
 *
 * A change shows at once; `pending` holds the slugs with a request in flight so a second tap on
 * the same path cannot race the first.
 */
export type ProgressStatus = "loading" | "ready" | "error";

export type ProgressState = {
  status: ProgressStatus;
  entries: PathProgress[];
  pending: string[];
};

export const INITIAL_PROGRESS: ProgressState = { status: "loading", entries: [], pending: [] };

export type ProgressAction =
  | { type: "load" }
  | { type: "loaded"; entries: PathProgress[] }
  | { type: "load-failed" }
  /** Show the change before the API answers; `entry` undefined removes the path from the list. */
  | { type: "apply"; slug: string; entry: PathProgress | undefined }
  /** The API answered: the entry it kept replaces the optimistic one. */
  | { type: "settled"; slug: string; entry: PathProgress }
  /** The API refused: put the entry back how it was (undefined: it was not in the list). */
  | { type: "rollback"; slug: string; previous: PathProgress | undefined };

const without = (list: readonly string[], slug: string) => list.filter((x) => x !== slug);
const withSlug = (list: readonly string[], slug: string) =>
  list.includes(slug) ? [...list] : [...list, slug];

/** Replaces or removes one entry and keeps the list in order. */
function put(
  entries: readonly PathProgress[],
  slug: string,
  entry: PathProgress | undefined,
): PathProgress[] {
  const rest = entries.filter((e) => e.slug !== slug);
  return sortEntries(entry && !isBlank(entry) ? [entry, ...rest] : rest);
}

export function progressReducer(state: ProgressState, action: ProgressAction): ProgressState {
  switch (action.type) {
    case "load":
      return { ...state, status: "loading" };
    case "loaded":
      return { ...state, status: "ready", entries: sortEntries(action.entries) };
    case "load-failed":
      return { ...state, status: "error" };
    case "apply":
      return {
        ...state,
        entries: put(state.entries, action.slug, action.entry),
        pending: withSlug(state.pending, action.slug),
      };
    case "settled":
      return {
        ...state,
        entries: put(state.entries, action.slug, action.entry),
        pending: without(state.pending, action.slug),
      };
    case "rollback":
      return {
        ...state,
        entries: put(state.entries, action.slug, action.previous),
        pending: without(state.pending, action.slug),
      };
  }
}

export const entryOf = (state: ProgressState, slug: string) =>
  state.entries.find((e) => e.slug === slug);

export const isPendingSlug = (state: ProgressState, slug: string) => state.pending.includes(slug);

/** Same pattern the API enforces (^[a-z0-9][a-z0-9-]{0,63}$), so a bad id never leaves the browser. */
export const isValidId = (id: string) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
