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
import {
  withLessonDone,
  withLessonUndone,
  withStar,
  withStart,
} from "../../lib/app/progress-logic";
import {
  entryOf,
  INITIAL_PROGRESS,
  isPendingSlug,
  isValidId,
  type ProgressStatus,
  progressReducer,
} from "../../lib/app/progress-state";
import {
  failureToast,
  lessonDoneToast,
  lessonUndoneToast,
  type ProgressOp,
  startedToast,
} from "../../lib/app/progress-toast";
import type { SavedToastModel } from "../../lib/app/saved-toast";
import type { ApiErrorCode, ApiResult } from "../../lib/auth/api";
import {
  listPaths,
  markLessonDone,
  type PathProgress,
  starPath,
  startPath,
  undoLessonDone,
  unstarPath,
} from "../../lib/auth/progress-api";
import { SavedToastHost, type ShownToast } from "../app-saved/saved-toast";

/**
 * The learner's path progress for the whole signed-in app (mounted in app/(app)/layout.tsx; it sits
 * outside the shell so the sidebar can read it too). The list loads once; every change shows on
 * screen at once and rolls back with a toast if the API refuses (lib/app/progress-state.ts). The
 * toast host is the one bookmarking uses; a second toast replaces the first.
 *
 * `usePaths()` is the surface for screens (path page, lesson page, My paths, sidebar, Home).
 */
export type PathsValue = {
  status: ProgressStatus;
  /** Started or starred paths, most recent activity first. */
  entries: PathProgress[];
  get: (slug: string) => PathProgress | undefined;
  isStarred: (slug: string) => boolean;
  /** A request for this path is in flight; the controls wait instead of racing it. */
  isPending: (slug: string) => boolean;
  /** Resolves true when the API accepted the change. A change for a pending path is refused (false). */
  start: (slug: string) => Promise<boolean>;
  /** `lessonNumber` only words the toast ("Lesson 4 done"). */
  markDone: (
    slug: string,
    lessonId: string,
    total: number,
    lessonNumber?: number,
  ) => Promise<boolean>;
  undo: (slug: string, lessonId: string, total: number, lessonNumber?: number) => Promise<boolean>;
  toggleStar: (slug: string) => Promise<boolean>;
  reload: () => void;
};

const now = () => new Date().toISOString();

const PathsContext = createContext<PathsValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(progressReducer, INITIAL_PROGRESS);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [toast, setToast] = useState<ShownToast | null>(null);
  const toastKey = useRef(0);

  const show = useCallback((model: SavedToastModel, run?: () => void) => {
    toastKey.current += 1;
    setToast({ key: toastKey.current, model, run });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);

  const load = useCallback(async (signal?: AbortSignal) => {
    dispatch({ type: "load" });
    const result = await listPaths(signal);
    if (signal?.aborted) return;
    if (result.ok) dispatch({ type: "loaded", entries: result.data });
    else dispatch({ type: "load-failed" });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /**
   * One change: show `next` now, send `call`, then keep the API's answer or roll back with a toast.
   * `onDone` runs after success (toasts). Resolves whether the API accepted it.
   */
  const change = useCallback(
    async (
      slug: string,
      op: ProgressOp,
      next: PathProgress | undefined,
      call: () => Promise<ApiResult<PathProgress>>,
      onDone: (saved: PathProgress) => void,
      retry: () => void,
    ): Promise<boolean> => {
      if (!isValidId(slug) || isPendingSlug(stateRef.current, slug)) return false;
      const previous = entryOf(stateRef.current, slug);
      dispatch({ type: "apply", slug, entry: next });
      const result = await call();
      if (result.ok) {
        dispatch({ type: "settled", slug, entry: result.data });
        onDone(result.data);
        return true;
      }
      dispatch({ type: "rollback", slug, previous });
      const model = failureToast(result.code as ApiErrorCode, op);
      show(model, model.action === "retry" ? retry : undefined);
      return false;
    },
    [show],
  );

  const start = useCallback(
    (slug: string): Promise<boolean> => {
      const current = entryOf(stateRef.current, slug);
      if (current?.startedAt) return Promise.resolve(true);
      return change(
        slug,
        "start",
        withStart(current, slug, now()),
        () => startPath(slug),
        () => show(startedToast()),
        () => void start(slug),
      );
    },
    [change, show],
  );

  const undoLesson = useCallback(
    (slug: string, lessonId: string, total: number, lessonNumber?: number): Promise<boolean> => {
      const current = entryOf(stateRef.current, slug);
      if (!current?.completedLessonIds.includes(lessonId)) return Promise.resolve(true);
      return change(
        slug,
        "undo",
        withLessonUndone(current, lessonId, now()),
        () => undoLessonDone(slug, lessonId),
        () => show(lessonUndoneToast(lessonNumber ?? null)),
        () => void undoLesson(slug, lessonId, total, lessonNumber),
      );
    },
    [change, show],
  );

  const markDone = useCallback(
    (slug: string, lessonId: string, total: number, lessonNumber?: number): Promise<boolean> => {
      if (!isValidId(lessonId)) return Promise.resolve(false);
      const current = entryOf(stateRef.current, slug);
      if (current?.completedLessonIds.includes(lessonId)) return Promise.resolve(true);
      const undo = () => void undoLesson(slug, lessonId, total, lessonNumber);
      return change(
        slug,
        "done",
        withLessonDone(current, slug, lessonId, total, now()),
        () => markLessonDone(slug, lessonId, total),
        (saved) =>
          show(lessonDoneToast(lessonNumber ?? null, saved.completedLessonIds.length, total), undo),
        () => void markDone(slug, lessonId, total, lessonNumber),
      );
    },
    [change, show, undoLesson],
  );

  const toggleStar = useCallback(
    (slug: string): Promise<boolean> => {
      const current = entryOf(stateRef.current, slug);
      const starred = current?.starredAt != null;
      const op = starred ? "unstar" : "star";
      return change(
        slug,
        op,
        withStar(current, slug, !starred, now()),
        () => (starred ? unstarPath(slug) : starPath(slug)),
        () => {},
        () => void toggleStar(slug),
      );
    },
    [change],
  );

  const value = useMemo<PathsValue>(
    () => ({
      status: state.status,
      entries: state.entries,
      get: (slug) => entryOf(state, slug),
      isStarred: (slug) => entryOf(state, slug)?.starredAt != null,
      isPending: (slug) => isPendingSlug(state, slug),
      start,
      markDone,
      undo: undoLesson,
      toggleStar,
      reload: () => void load(),
    }),
    [state, start, markDone, undoLesson, toggleStar, load],
  );

  return (
    <PathsContext.Provider value={value}>
      {children}
      <SavedToastHost toast={toast} onDismiss={dismiss} />
    </PathsContext.Provider>
  );
}

export function usePaths(): PathsValue {
  const value = useContext(PathsContext);
  if (!value) throw new Error("usePaths must be used inside the app layout");
  return value;
}

/** For pieces that may render outside the app layout (tests, previews): null instead of throwing. */
export const useOptionalPaths = (): PathsValue | null => useContext(PathsContext);
