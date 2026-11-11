/**
 * Pure state behind bookmarking (packages/backend/SAVED.md): the learner's saved ids, newest
 * first, with optimistic changes that roll back when the API refuses. The provider
 * (components/app-saved/saved-provider.tsx) wires this reducer to the API and the toasts.
 *
 * A change is applied on screen at once; `pending` holds the ids with a request in flight so a
 * second tap on the same bookmark cannot race the first.
 */
export type SavedEntry = { resourceId: string; savedAt: number };

export type SavedStatus = "loading" | "ready" | "error";

export type SavedState = {
  status: SavedStatus;
  /** Newest first. */
  entries: SavedEntry[];
  /** Ids with a save or remove request in flight. */
  pending: string[];
};

export const INITIAL_SAVED: SavedState = { status: "loading", entries: [], pending: [] };

export type SavedAction =
  | { type: "load" }
  | { type: "loaded"; entries: SavedEntry[] }
  | { type: "load-failed" }
  /** Show the change before the API answers. */
  | { type: "add"; entry: SavedEntry }
  | { type: "drop"; resourceId: string }
  /** The API answered for an id: the entry it kept (or undefined after a remove) and the end of the request. */
  | { type: "settled"; resourceId: string; entry?: SavedEntry }
  /** The API refused: put the screen back how it was. */
  | { type: "rollback-add"; resourceId: string }
  | { type: "rollback-drop"; entry: SavedEntry };

/** Newest first; entries with the same time keep the order they arrived in. */
export function sortNewestFirst(entries: readonly SavedEntry[]): SavedEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.savedAt - a.entry.savedAt || a.index - b.index)
    .map(({ entry }) => entry);
}

/** Puts an entry at its place in a newest-first list; an id already there is replaced. */
export function insertEntry(entries: readonly SavedEntry[], entry: SavedEntry): SavedEntry[] {
  return sortNewestFirst([entry, ...entries.filter((e) => e.resourceId !== entry.resourceId)]);
}

const without = (list: readonly string[], id: string) => list.filter((x) => x !== id);
const withId = (list: readonly string[], id: string) =>
  list.includes(id) ? [...list] : [...list, id];

export function savedReducer(state: SavedState, action: SavedAction): SavedState {
  switch (action.type) {
    case "load":
      return { ...state, status: "loading" };
    case "loaded":
      return { ...state, status: "ready", entries: sortNewestFirst(action.entries) };
    case "load-failed":
      return { ...state, status: "error" };
    case "add":
      return {
        ...state,
        entries: insertEntry(state.entries, action.entry),
        pending: withId(state.pending, action.entry.resourceId),
      };
    case "drop":
      return {
        ...state,
        entries: state.entries.filter((e) => e.resourceId !== action.resourceId),
        pending: withId(state.pending, action.resourceId),
      };
    case "settled":
      return {
        ...state,
        entries: action.entry ? insertEntry(state.entries, action.entry) : state.entries,
        pending: without(state.pending, action.resourceId),
      };
    case "rollback-add":
      return {
        ...state,
        entries: state.entries.filter((e) => e.resourceId !== action.resourceId),
        pending: without(state.pending, action.resourceId),
      };
    case "rollback-drop":
      return {
        ...state,
        entries: insertEntry(state.entries, action.entry),
        pending: without(state.pending, action.entry.resourceId),
      };
  }
}

export const isSavedId = (state: SavedState, id: string) =>
  state.entries.some((e) => e.resourceId === id);

export const isPendingId = (state: SavedState, id: string) => state.pending.includes(id);

/**
 * The saved ids (newest first) as catalogue items, and ids that no longer resolve (the item
 * left the catalogue) are skipped without a word.
 */
export function resolveSaved<T extends { id: string }>(
  ids: readonly string[],
  items: readonly T[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

/** "1 saved resource" / "12 saved resources". */
export const savedCountText = (n: number) => `${n} saved ${n === 1 ? "resource" : "resources"}`;

/** Same pattern the API enforces (^[a-z0-9][a-z0-9-]{0,63}$), so a bad id never leaves the browser. */
export const isValidResourceId = (id: string) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
