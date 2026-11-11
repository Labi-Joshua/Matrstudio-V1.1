"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ApiFailure, ApiResult } from "../api";
import { DEFAULT_RANGE, type DashRange, parseRangeSearch, rangeQuery } from "./range";

/** A skeleton waits this long before showing, so fast responses never flash one. */
export const SKELETON_DELAY_MS = 150;
/** Once shown, a skeleton stays at least this long, so it never flickers away. */
export const SKELETON_MIN_MS = 300;

export const skeletonRemainingMs = (shownAt: number, now: number): number =>
  Math.max(0, SKELETON_MIN_MS - (now - shownAt));

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

/** Whether the browser reports a connection. */
export function useOnline(): boolean {
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

export type Remote<T> = {
  /** "loading" while a request is out (data may still hold the previous answer). */
  status: "loading" | "ok" | "error";
  data: T | undefined;
  error: ApiFailure | undefined;
  reload: () => void;
  /** Replaces the loaded data (optimistic edits). */
  setData: (next: T) => void;
};

/**
 * Loads `load(signal)` when `enabled` and again when `key` changes or `reload` is called. A stale
 * answer is dropped. Data from the previous key stays until the new answer arrives.
 */
export function useRemote<T>(
  load: (signal: AbortSignal) => Promise<ApiResult<T>>,
  key: string,
  enabled = true,
): Remote<T> {
  const [state, setState] = useState<{
    status: Remote<T>["status"];
    data: T | undefined;
    error: ApiFailure | undefined;
  }>({ status: "loading", data: undefined, error: undefined });
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  // biome-ignore lint/correctness/useExhaustiveDependencies: key and nonce are the triggers
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState((s) => ({ ...s, status: "loading", error: undefined }));
    loadRef.current(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState(
        result.ok
          ? { status: "ok", data: result.data, error: undefined }
          : { status: "error", data: undefined, error: result },
      );
    });
    return () => controller.abort();
  }, [key, nonce, enabled]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((next: T) => setState((s) => ({ ...s, data: next })), []);
  return { ...state, reload, setData };
}

/** The date range, kept in the address bar (?range=30d or ?range=custom&from=&to=) between pages. */
export function useRange(): {
  range: DashRange;
  ready: boolean;
  setRange: (next: DashRange) => void;
} {
  const [range, setRangeState] = useState<DashRange>(DEFAULT_RANGE);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setRangeState(parseRangeSearch(window.location.search));
    setReady(true);
  }, []);
  const setRange = useCallback((next: DashRange) => {
    setRangeState(next);
    const params = new URLSearchParams(window.location.search);
    for (const k of ["range", "from", "to"]) params.delete(k);
    const merged = new URLSearchParams(
      `${params.toString()}${params.size ? "&" : ""}${rangeQuery(next)}`,
    );
    window.history.replaceState(null, "", `${window.location.pathname}?${merged.toString()}`);
  }, []);
  return { range, ready, setRange };
}

/** Appends the range to a path ("/metrics/paths" -> "/metrics/paths?range=30d"). */
export function withRange(href: string, range: DashRange): string {
  return `${href}${href.includes("?") ? "&" : "?"}${rangeQuery(range)}`;
}

/** Open/close state for a popover: Escape closes it and returns focus to the button, a press outside closes it. */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && rootRef.current && !rootRef.current.contains(next)) setOpen(false);
    };
    const root = rootRef.current;
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    root?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      root?.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);
  return { open, setOpen, rootRef, buttonRef };
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal behaviour while mounted: focus moves in, Tab is trapped, Escape closes, scroll locks, focus returns. */
export function useModalSurface(panelRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
  }, [panelRef]);
}
