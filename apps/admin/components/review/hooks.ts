"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ApiFailure, ApiResult } from "../../lib/api";

export const SKELETON_DELAY_MS = 150;
export const SKELETON_MIN_MS = 300;

/** A skeleton waits 150 ms before showing and, once shown, stays at least 300 ms. */
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
    const wait = Math.max(0, SKELETON_MIN_MS - (Date.now() - shownAt.current));
    const timer = setTimeout(() => setShown(false), wait);
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal behaviour: focus in, Tab trapped, Escape closes, page scroll locked, focus returns. */
export function useModalSurface(
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [panelRef, active]);
}

export type Loaded<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; failure: ApiFailure };

/**
 * Runs `load` whenever `key` changes (or reload() is called), aborting the previous request.
 * `load` must be stable per key; it is read through a ref.
 */
export function useLoad<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<ApiResult<T>>,
): { state: Loaded<T>; reload: () => void; setData: (next: T) => void } {
  const [state, setState] = useState<Loaded<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  // biome-ignore lint/correctness/useExhaustiveDependencies: key and tick are the triggers
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    loadRef.current(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState(
        result.ok ? { status: "ready", data: result.data } : { status: "error", failure: result },
      );
    });
    return () => controller.abort();
  }, [key, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  const setData = useCallback((next: T) => setState({ status: "ready", data: next }), []);
  return { state, reload, setData };
}
