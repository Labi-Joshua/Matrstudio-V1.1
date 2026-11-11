"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiFailure, ApiResult } from "../../lib/api";
import { type ListFilters, queryOf } from "../../lib/review/api";
import type { Counts, Page } from "../../lib/review/types";
import { useLoad } from "./hooks";

export type QueueState<T> =
  | { status: "loading" }
  | { status: "error"; failure: ApiFailure }
  | {
      status: "ready";
      items: T[];
      hasMore: boolean;
      loadingMore: boolean;
      moreError: boolean;
    };

/**
 * One queue list: the first page loads whenever the tab or filters change, "Load more" appends the
 * next page. `onCounts` receives the tab counts the API sends along (shown on the tab chips).
 */
export function useQueue<T extends { id: string }>(
  tab: string,
  filters: ListFilters,
  fetchPage: (f: ListFilters, signal?: AbortSignal) => Promise<ApiResult<Page<T>>>,
  onCounts: (counts: Counts) => void,
) {
  const key = `${tab}${queryOf(filters)}`;
  const { state, reload } = useLoad(key, (signal) => fetchPage(filters, signal));
  const [extra, setExtra] = useState<{ key: string; items: T[]; cursor: string | null } | null>(
    null,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const countsRef = useRef(onCounts);
  countsRef.current = onCounts;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new key or reload clears extra pages
  useEffect(() => {
    setExtra(null);
    setMoreError(false);
  }, [key, state.status]);

  useEffect(() => {
    if (state.status === "ready" && state.data.counts) countsRef.current(state.data.counts);
  }, [state]);

  async function loadMore() {
    if (state.status !== "ready") return;
    const cursor = extra && extra.key === key ? extra.cursor : state.data.nextCursor;
    if (!cursor) return;
    setLoadingMore(true);
    setMoreError(false);
    const result = await fetchPage({ ...filters, cursor });
    setLoadingMore(false);
    if (!result.ok) {
      setMoreError(true);
      return;
    }
    const previous = extra && extra.key === key ? extra.items : [];
    const seen = new Set([...state.data.items, ...previous].map((i) => i.id));
    const fresh = result.data.items.filter((i) => !seen.has(i.id));
    setExtra({ key, items: [...previous, ...fresh], cursor: result.data.nextCursor });
  }

  let view: QueueState<T>;
  if (state.status === "loading") view = { status: "loading" };
  else if (state.status === "error") view = { status: "error", failure: state.failure };
  else {
    const more = extra && extra.key === key ? extra : null;
    view = {
      status: "ready",
      items: [...state.data.items, ...(more?.items ?? [])],
      hasMore: (more ? more.cursor : state.data.nextCursor) !== null,
      loadingMore,
      moreError,
    };
  }
  return { view, reload, loadMore };
}
