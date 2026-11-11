"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { buildLibraryModel } from "../../lib/app/library-data";
import {
  INITIAL_SAVED,
  isPendingId,
  isSavedId,
  isValidResourceId,
  type SavedStatus,
  savedReducer,
} from "../../lib/app/saved-state";
import {
  failureToast,
  removedToast,
  type SavedOp,
  type SavedToastModel,
  savedToast,
} from "../../lib/app/saved-toast";
import type { ApiErrorCode } from "../../lib/auth/api";
import { listSaved, saveResource, unsaveResource } from "../../lib/auth/saved-api";
import { getCatalogue } from "../../lib/catalogue/data";
import { SavedToastHost, type ShownToast } from "./saved-toast";

/**
 * The learner's bookmarks for everything inside the app shell (mounted in app/(app)/layout.tsx,
 * so it only exists once /api/me answered 200). The ids load once; every change shows on screen
 * at once and rolls back with a toast if the API refuses (lib/app/saved-state.ts). One toast host
 * serves the whole app, so a second toast replaces the first.
 */
export type SavedValue = {
  status: SavedStatus;
  /** Newest first. */
  ids: string[];
  isSaved: (id: string) => boolean;
  /** A request for this id is in flight; the control waits instead of racing it. */
  isPending: (id: string) => boolean;
  /** Bookmark button: saves, or removes (with an Undo toast) when already saved. */
  toggle: (id: string) => void;
  remove: (id: string) => void;
  /** Puts back what `remove` took out (the Undo button). */
  undo: (id: string) => void;
  reload: () => void;
};

const SavedContext = createContext<SavedValue | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(savedReducer, INITIAL_SAVED);
  const stateRef = useRef(state);
  stateRef.current = state;
  const inflight = useRef(new Set<string>());
  const [toast, setToast] = useState<ShownToast | null>(null);
  const toastKey = useRef(0);

  const titles = useMemo(
    () => new Map(buildLibraryModel(getCatalogue()).items.map((item) => [item.id, item.title])),
    [],
  );

  const show = useCallback((model: SavedToastModel, run?: () => void) => {
    toastKey.current += 1;
    setToast({ key: toastKey.current, model, run });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);

  const load = useCallback(async (signal?: AbortSignal) => {
    dispatch({ type: "load" });
    const result = await listSaved(signal);
    if (signal?.aborted) return;
    if (result.ok) dispatch({ type: "loaded", entries: result.data });
    else dispatch({ type: "load-failed" });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const fail = useCallback(
    (code: ApiErrorCode, op: SavedOp, retry: () => void) => {
      const model = failureToast(code, op);
      show(model, model.action === "retry" ? retry : undefined);
    },
    [show],
  );

  const save = useCallback(
    async (id: string, quiet = false): Promise<void> => {
      if (!isValidResourceId(id) || inflight.current.has(id) || isSavedId(stateRef.current, id)) {
        return;
      }
      inflight.current.add(id);
      dispatch({
        type: "add",
        entry: { resourceId: id, savedAt: Math.floor(Date.now() / 1000) },
      });
      const result = await saveResource(id);
      inflight.current.delete(id);
      if (result.ok) {
        dispatch({ type: "settled", resourceId: id, entry: result.data });
        if (quiet) setToast(null);
        else show(savedToast());
        return;
      }
      dispatch({ type: "rollback-add", resourceId: id });
      fail(result.code, "save", () => void save(id, quiet));
    },
    [show, fail],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const entry = stateRef.current.entries.find((e) => e.resourceId === id);
      if (!entry || inflight.current.has(id)) return;
      inflight.current.add(id);
      dispatch({ type: "drop", resourceId: id });
      const result = await unsaveResource(id);
      inflight.current.delete(id);
      if (result.ok) {
        dispatch({ type: "settled", resourceId: id });
        show(removedToast(titles.get(id)), () => void save(id, true));
        return;
      }
      dispatch({ type: "rollback-drop", entry });
      fail(result.code, "remove", () => void remove(id));
    },
    [show, fail, save, titles],
  );

  const toggle = useCallback(
    (id: string) => {
      const current = stateRef.current;
      if (current.status !== "ready") {
        if (current.status === "error") fail("network_error", "load", () => void load());
        return;
      }
      void (isSavedId(current, id) ? remove(id) : save(id));
    },
    [save, remove, fail, load],
  );

  const value = useMemo<SavedValue>(
    () => ({
      status: state.status,
      ids: state.entries.map((e) => e.resourceId),
      isSaved: (id) => isSavedId(state, id),
      isPending: (id) => isPendingId(state, id),
      toggle,
      remove: (id) => void remove(id),
      undo: (id) => void save(id, true),
      reload: () => void load(),
    }),
    [state, toggle, remove, save, load],
  );

  return (
    <SavedContext.Provider value={value}>
      {children}
      <SavedToastHost toast={toast} onDismiss={dismiss} />
    </SavedContext.Provider>
  );
}

export function useSaved(): SavedValue {
  const value = useContext(SavedContext);
  if (!value) throw new Error("useSaved must be used inside the app shell");
  return value;
}
