"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/** Same behaviour as the learner app's hooks (copied: no cross-app imports). */
export const SKELETON_DELAY_MS = 150;
export const SKELETON_MIN_MS = 300;

export const skeletonRemainingMs = (shownAt: number, now: number) =>
  Math.max(0, SKELETON_MIN_MS - (now - shownAt));

/** False for the first 150 ms of a request, then true until the data arrived and 300 ms passed. */
export function useSkeletonGate(pending: boolean): boolean {
  const [shown, setShown] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    if (pending) {
      if (shown) return;
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setShown(true);
      }, SKELETON_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (!shown) return;
    const timer = setTimeout(
      () => setShown(false),
      skeletonRemainingMs(shownAt.current, Date.now()),
    );
    return () => clearTimeout(timer);
  }, [pending, shown]);
  return shown;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("online", notify);
      window.addEventListener("offline", notify);
      return () => {
        window.removeEventListener("online", notify);
        window.removeEventListener("offline", notify);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open modal surfaces, innermost last: only the top one reacts to Esc and Tab. */
const stack: symbol[] = [];

/**
 * Behaviour of a modal while mounted: focus moves in, Tab stays inside, Esc closes the top-most
 * modal, the page behind does not scroll, focus returns to the opener on unmount. Stacked modals
 * (a re-auth prompt over a confirm) work: only the one on top handles keys.
 */
export function useModalSurface(
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const id = Symbol("modal");
    stack.push(id);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    (
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE)
    )?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const at = stack.indexOf(id);
      if (at >= 0) stack.splice(at, 1);
      if (stack.length === 0) document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [panelRef, active]);
}

/** Runs `load` on mount and whenever `reload` is called; keeps the last data while refreshing. */
export type Loaded<T> =
  | { status: "loading" }
  | { status: "error"; code: string; message: string }
  | { status: "ready"; data: T };

import type { ApiResult } from "../api";

export function useLoader<T>(load: () => Promise<ApiResult<T>>, deps: readonly unknown[]) {
  const [state, setState] = useState<Loaded<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are the caller's inputs; attempt re-runs on retry
  useEffect(() => {
    let current = true;
    setState((prev) => (prev.status === "ready" ? prev : { status: "loading" }));
    loadRef.current().then((result) => {
      if (!current) return;
      setState(
        result.ok
          ? { status: "ready", data: result.data }
          : { status: "error", code: result.code, message: result.message },
      );
    });
    return () => {
      current = false;
    };
  }, [attempt, ...deps]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setData = useCallback((data: T) => setState({ status: "ready", data }), []);
  return { state, reload, setData };
}
