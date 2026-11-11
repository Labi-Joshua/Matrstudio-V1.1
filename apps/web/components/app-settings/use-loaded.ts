"use client";

import { useCallback, useEffect, useState } from "react";
import type { Loaded } from "../../lib/app/settings-state";
import type { ApiResult } from "../../lib/auth/api";

/**
 * Loads one Settings resource on mount (and again on reload). `set` replaces the data once it is
 * ready, for optimistic updates and for answers to a save.
 */
export function useLoaded<T>(load: (signal: AbortSignal) => Promise<ApiResult<T>>) {
  const [state, setState] = useState<Loaded<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: nonce re-runs the load on reload()
  useEffect(() => {
    const controller = new AbortController();
    // A reload while data is showing keeps it on screen (no skeleton flash); an error retry shows loading.
    setState((s) => (s.status === "ready" ? s : { status: "loading" }));
    load(controller.signal).then((result) => {
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
