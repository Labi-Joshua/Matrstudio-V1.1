"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ApiFailure } from "../../lib/api";
import {
  flattenHits,
  hitDetail,
  hitHref,
  normaliseQuery,
  type ShownGroup,
  shownGroups,
} from "../../lib/nav/search";
import { type SearchGroupId, searchAdmin } from "../../lib/session/api";
import { useAdminSession } from "../../lib/session/provider";
import { useModalSurface, useSkeletonGate } from "../ui/hooks";
import {
  PathsIcon,
  ResourcesIcon,
  ReviewIcon,
  SearchIcon,
  SearchXIcon,
  UserIcon,
} from "../ui/icons";
import { Skeleton } from "../ui/skeleton";

const GROUP_ICON: Record<SearchGroupId, (p: { size?: number }) => React.ReactNode> = {
  users: UserIcon,
  resources: ResourcesIcon,
  paths: PathsIcon,
  submissions: ReviewIcon,
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "results"; groups: ShownGroup[] }
  | { status: "error"; failure: ApiFailure };

const DEBOUNCE_MS = 200;

/**
 * Cmd/Ctrl+K search (Figma Nav 7 and "Search: no results"). Results come from
 * GET /api/admin/search?q= (users, resources, paths, submissions; lesson text inside paths is
 * matched server side) and are filtered again by the admin's areas. Arrow keys move, Enter opens,
 * Esc closes; focus is trapped and returns to the opener.
 */
export function SearchPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { me, handleFailure } = useAdminSession();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [active, setActive] = useState(0);
  const [retry, setRetry] = useState(0);
  useModalSurface(panelRef, onClose);
  const showSkeleton = useSkeletonGate(state.status === "loading");

  const term = normaliseQuery(query);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `retry` re-runs the search after an error
  useEffect(() => {
    if (!term) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const result = await searchAdmin(term, controller.signal);
      if (controller.signal.aborted) return;
      if (result.ok) {
        setState({ status: "results", groups: shownGroups(result.data, me) });
        setActive(0);
      } else if (!handleFailure(result)) setState({ status: "error", failure: result });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, me, handleFailure, retry]);

  const groups = state.status === "results" ? state.groups : [];
  const flat = useMemo(() => flattenHits(groups), [groups]);

  function open(index: number) {
    const hit = flat[index];
    if (!hit) return;
    onClose();
    router.push(hitHref(hit));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (flat.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      open(active);
    }
  }

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  let index = -1;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12dvh]">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-static-black/60 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={onKeyDown}
        className="relative flex max-h-[70dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-border-soft bg-bg-base shadow-e2"
      >
        <div className="flex items-center gap-2 border-border-soft border-b px-4">
          <SearchIcon size={18} className="shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-activedescendant={flat.length > 0 ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="Search users, resources and paths"
            placeholder="Search users, resources, paths"
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-text-tertiary md:text-[14px]"
          />
          <kbd className="rounded-md border border-border-soft bg-bg-fill2 px-1.5 py-0.5 font-medium text-[11px] text-text-tertiary leading-4">
            Esc
          </kbd>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <p role="status" aria-live="polite" className="sr-only">
            {state.status === "results"
              ? flat.length === 0
                ? `No results for ${term}`
                : `${flat.length} results`
              : ""}
          </p>
          {state.status === "idle" ? (
            <p className="px-3 py-8 text-center text-[14px] text-text-secondary">
              Search for a user, resource, path or submission.
            </p>
          ) : null}
          {state.status === "loading" && showSkeleton ? (
            <div aria-busy="true" className="flex flex-col gap-3 p-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-8 shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-2/5" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {state.status === "error" ? (
            <div role="alert" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <p className="font-medium text-[14px] text-text">Search isn’t working right now</p>
              <p className="text-[13px] text-text-secondary">Try again in a moment.</p>
              <button
                type="button"
                onClick={() => setRetry((n) => n + 1)}
                className="mt-1 h-8 rounded-lg border border-border bg-bg-elevation-1 px-3 font-medium text-[13px] text-text focus-visible:outline-2 focus-visible:outline-primary-border"
              >
                Try again
              </button>
            </div>
          ) : null}
          {state.status === "results" && flat.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
              <SearchXIcon size={24} className="text-text-tertiary" />
              <p className="mt-1 font-medium text-[15px] text-text leading-5">
                No results for “{term}”
              </p>
              <p className="text-[13px] text-text-secondary leading-[18px]">
                Check the spelling, or search for a user, resource or path.
              </p>
            </div>
          ) : null}
          {groups.length > 0 ? (
            <div id={listId} role="listbox" aria-label="Results" className="flex flex-col">
              {groups.map((group) => {
                const Icon = GROUP_ICON[group.id];
                return (
                  <div key={group.id} role="presentation">
                    <p className="px-3 pt-2 pb-1 font-medium text-[11px] text-text-tertiary uppercase leading-4 tracking-[0.6px]">
                      {group.label}
                    </p>
                    {group.hits.map((hit) => {
                      index += 1;
                      const i = index;
                      return (
                        <div
                          key={`${hit.group}-${hit.id}`}
                          id={`${listId}-${i}`}
                          role="option"
                          tabIndex={-1}
                          aria-selected={i === active}
                          onPointerMove={() => setActive(i)}
                          onClick={() => open(i)}
                          onKeyDown={(event) => event.key === "Enter" && open(i)}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${i === active ? "bg-bg-fill2" : ""}`}
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center text-text-secondary">
                            <Icon size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
                              {hit.title}
                            </span>
                            <span className="block truncate text-[12px] text-text-secondary leading-4">
                              {hitDetail(hit)}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="hidden items-center gap-4 border-border-soft border-t px-4 py-2.5 text-[12px] text-text-tertiary leading-4 md:flex">
          <span>↑↓ to move</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
