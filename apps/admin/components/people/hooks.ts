"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ApiFailure, ApiResult } from "../../lib/api";
import { getAccess } from "../../lib/people/api";
import type { Access } from "../../lib/people/parse";

/** A skeleton waits this long before showing, then stays at least SKELETON_MIN_MS. */
export const SKELETON_DELAY_MS = 150;
export const SKELETON_MIN_MS = 300;

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

export type Loaded<T> =
  | { status: "loading" }
  | { status: "error"; failure: ApiFailure }
  | { status: "ready"; data: T };

/**
 * Runs `load` on mount and whenever `key` changes (aborting the previous call). `reload` runs it
 * again, keeping the data on screen while it does (no flash back to a skeleton).
 */
export function useLoaded<T>(
  load: (signal: AbortSignal) => Promise<ApiResult<T>>,
  key: string,
): { state: Loaded<T>; reload: () => void; setData: (next: T) => void } {
  const [state, setState] = useState<Loaded<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const keyRef = useRef(key);

  // biome-ignore lint/correctness/useExhaustiveDependencies: key and tick are the triggers
  useEffect(() => {
    const controller = new AbortController();
    if (keyRef.current !== key) {
      keyRef.current = key;
      setState({ status: "loading" });
    }
    loadRef.current(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      // A failed reload shows the error state: we never pretend stale data is current.
      setState(
        result.ok ? { status: "ready", data: result.data } : { status: "error", failure: result },
      );
    });
    return () => controller.abort();
  }, [key, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const setData = useCallback((data: T) => setState({ status: "ready", data }), []);
  return { state, reload, setData };
}

/** The signed-in admin's access to this area, read once from GET /me. */
let accessPromise: Promise<ApiResult<Access>> | null = null;

export function useAccess(): Access | null {
  const [access, setAccess] = useState<Access | null>(null);
  useEffect(() => {
    let live = true;
    accessPromise ??= getAccess();
    accessPromise.then((r) => {
      if (!r.ok) accessPromise = null;
      // Unreadable access: assume the least (view only), the API still enforces the real rule.
      if (live) setAccess(r.ok ? r.data : { superAdmin: false, users: "view", support: "view" });
    });
    return () => {
      live = false;
    };
  }, []);
  return access;
}

/** Current time, refreshed every minute so "due in 6 hours" stays honest. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Debounced copy of a value. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setV(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return v;
}
