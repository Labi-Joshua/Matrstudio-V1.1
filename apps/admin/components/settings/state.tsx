"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { ApiFailure, ApiResult } from "../../lib/api";
import { AlertCircleIcon, BTN_SECONDARY } from "./ui";

export type Loaded<T> =
  | { status: "loading" }
  | { status: "error"; failure: ApiFailure }
  | { status: "ready"; data: T };

/** Skeletons wait this long before showing and then stay at least this long (no flicker). */
const SKELETON_DELAY_MS = 150;
const SKELETON_MIN_MS = 300;

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

/**
 * Loads one resource on mount and again on reload(). `set` replaces ready data (optimistic
 * updates and answers to a save). A reload while data shows keeps it on screen.
 */
export function useLoaded<T>(load: (signal: AbortSignal) => Promise<ApiResult<T>>) {
  const [state, setState] = useState<Loaded<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  // biome-ignore lint/correctness/useExhaustiveDependencies: nonce re-runs the load on reload()
  useEffect(() => {
    const controller = new AbortController();
    setState((s) => (s.status === "ready" ? s : { status: "loading" }));
    loadRef.current(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState((prev) =>
        result.ok
          ? { status: "ready", data: result.data }
          : prev.status === "ready"
            ? prev
            : { status: "error", failure: result },
      );
    });
    return () => controller.abort();
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const set = useCallback(
    (update: (data: T) => T) =>
      setState((s) => (s.status === "ready" ? { status: "ready", data: update(s.data) } : s)),
    [],
  );
  return { state, reload, set };
}

export const BAR = "rounded-md bg-bg-fill2 motion-safe:animate-pulse";

/** Wraps a skeleton: the busy region and its text are always there, the shapes after the gate. */
export function SkeletonFrame({
  label,
  visible,
  children,
}: {
  label: string;
  visible: boolean;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className="min-h-[40vh]">
      <p className="sr-only">{label}</p>
      {visible ? <div aria-hidden="true">{children}</div> : null}
    </div>
  );
}

/** "Couldn't load" with Try again. Offline gets its own words. */
export function LoadError({
  what,
  failure,
  onRetry,
}: {
  what: string;
  failure?: ApiFailure;
  onRetry: () => void;
}) {
  const offline = failure?.code === "network_error";
  const denied = failure?.code === "forbidden";
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-[420px] flex-col items-center gap-3 px-2 py-16 text-center"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-error-focus text-error-text">
        <AlertCircleIcon size={24} />
      </span>
      <h2 className="font-medium text-[16px] text-text leading-6">
        {denied ? "You can’t open this" : `We couldn’t load ${what}`}
      </h2>
      <p className="text-[14px] text-text-secondary leading-5">
        {denied
          ? "Your role doesn’t include this part of Settings."
          : offline
            ? "You look to be offline. Check your connection and try again."
            : "Something went wrong on our side. Nothing was changed."}
      </p>
      {denied ? null : (
        <button type="button" onClick={onRetry} className={`${BTN_SECONDARY} mt-2`}>
          Try again
        </button>
      )}
    </div>
  );
}

/** What a failed save says: the API's message, or the offline words. */
export function saveFailureText(failure: ApiFailure): string {
  if (failure.code === "network_error")
    return "You look to be offline. Your changes are still here.";
  if (failure.code === "forbidden") return "Your role can’t change this.";
  if (failure.code === "rate_limited")
    return "Too many changes at once. Wait a moment and try again.";
  return failure.message && failure.message !== "Something went wrong."
    ? failure.message
    : "Something went wrong. Your changes are still here.";
}
