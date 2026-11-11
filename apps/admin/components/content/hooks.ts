"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { ApiResult } from "../../lib/api";

/** A skeleton waits this long before showing, so fast responses never flash one. */
export const SKELETON_DELAY_MS = 150;
/** Once shown, a skeleton stays at least this long. */
export const SKELETON_MIN_MS = 300;

export function skeletonRemainingMs(shownAt: number, now: number): number {
  return Math.max(0, SKELETON_MIN_MS - (now - shownAt));
}

/** Whether to draw the skeleton for a request that is `pending` (150 ms delay, 300 ms minimum). */
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focus trap, Escape, scroll lock and focus return for a modal while it is mounted. */
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
    const first = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    (first ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
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

/** A value that follows `value` after `ms` of quiet. */
export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export type Load<T> =
  | { state: "loading" }
  | { state: "error"; failure: Extract<ApiResult<T>, { ok: false }> }
  | { state: "ready"; data: T };

/**
 * Loads once per `key` change (and on `reload()`), aborting the stale request. `setData` lets a
 * caller keep the loaded value in step with edits without another round trip.
 */
export function useLoad<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<ApiResult<T>>,
): { load: Load<T>; reload: () => void; setData: (next: T) => void } {
  const [load, setLoad] = useState<Load<T>>({ state: "loading" });
  const [nonce, setNonce] = useState(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  // biome-ignore lint/correctness/useExhaustiveDependencies: key and nonce are the triggers
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ state: "loading" });
    fetchRef.current(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setLoad(
        result.ok ? { state: "ready", data: result.data } : { state: "error", failure: result },
      );
    });
    return () => controller.abort();
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((data: T) => setLoad({ state: "ready", data }), []);
  return { load, reload, setData };
}
