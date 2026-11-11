"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiFailure, ApiResult } from "../../lib/api";

export type PageOf<T> = { items: T[]; nextCursor: string | null; extra?: unknown };

export type Paged<T> = {
  status: "loading" | "ready" | "error";
  items: T[];
  extra: unknown;
  failure: ApiFailure | null;
  more: boolean;
  loadingMore: boolean;
  moreFailed: boolean;
  loadMore: () => void;
  reload: () => void;
};

/**
 * A cursor-paged list. A new `key` (filters changed) goes back to loading; `reload` refetches the
 * first page and keeps the rows on screen meanwhile. `extra` carries whatever the first page returned
 * besides rows (counts), refreshed on every load.
 */
export function usePaged<T>(
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<ApiResult<PageOf<T>>>,
  key: string,
): Paged<T> {
  const [state, setState] = useState<{
    status: Paged<T>["status"];
    items: T[];
    extra: unknown;
    cursor: string | null;
    failure: ApiFailure | null;
  }>({ status: "loading", items: [], extra: undefined, cursor: null, failure: null });
  const [tick, setTick] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const keyRef = useRef(key);
  const cursorRef = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: key and tick are the triggers
  useEffect(() => {
    const controller = new AbortController();
    if (keyRef.current !== key) {
      keyRef.current = key;
      setState({ status: "loading", items: [], extra: undefined, cursor: null, failure: null });
    }
    setMoreFailed(false);
    fetchRef.current(null, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) {
        cursorRef.current = result.data.nextCursor;
        setState({
          status: "ready",
          items: result.data.items,
          extra: result.data.extra,
          cursor: result.data.nextCursor,
          failure: null,
        });
      } else {
        setState((prev) => ({ ...prev, status: "error", failure: result }));
      }
    });
    return () => controller.abort();
  }, [key, tick]);

  const loadMore = useCallback(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    setLoadingMore(true);
    setMoreFailed(false);
    const controller = new AbortController();
    fetchRef.current(cursor, controller.signal).then((result) => {
      setLoadingMore(false);
      if (!result.ok) {
        setMoreFailed(true);
        return;
      }
      cursorRef.current = result.data.nextCursor;
      setState((prev) => ({
        ...prev,
        items: [...prev.items, ...result.data.items],
        cursor: result.data.nextCursor,
      }));
    });
  }, []);

  return {
    status: state.status,
    items: state.items,
    extra: state.extra,
    failure: state.failure,
    more: state.cursor !== null,
    loadingMore,
    moreFailed,
    loadMore,
    reload: useCallback(() => setTick((n) => n + 1), []),
  };
}
