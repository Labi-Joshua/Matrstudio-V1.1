"use client";

import { useMemo, useState } from "react";
import { getCatalogueData, pathHref } from "../../lib/app/paths-catalogue";
import {
  filterMine,
  MINE_FILTERS,
  type MineFilter,
  type MineState,
  type MyPath,
  mineCountLabel,
  mineEmptyCopy,
  percentDone,
  progressLabel,
  showMineFilters,
} from "../../lib/app/paths-state";
import { buildMine } from "../../lib/app/progress-logic";
import { getCatalogue } from "../../lib/catalogue/data";
import { usePaths } from "../app-progress/progress-provider";
import { Chip } from "./filters";
import {
  BUTTON_INVERSE,
  BUTTON_PRIMARY,
  EmptyState,
  ErrorState,
  PathCard,
  PathGrid,
} from "./parts";
import { useSkeletonGate } from "./skeleton-gate";
import { MyPathsSkeleton } from "./skeletons";

/**
 * "My paths" (Figma "My paths": All, In progress, Starred, Completed, "New account, no paths",
 * loading and couldn’t load). The list is the learner’s real progress (usePaths()): paths they
 * started or starred, with a star on every card and the progress strip on started ones.
 */
export function MyPaths({ onExplore }: { onExplore: () => void }) {
  const paths = usePaths();
  const state = useMemo<MineState>(() => {
    if (paths.status === "loading") return { status: "loading" };
    if (paths.status === "error") return { status: "error" };
    return {
      status: "ready",
      items: buildMine(paths.entries, getCatalogueData(getCatalogue()).paths),
    };
  }, [paths.status, paths.entries]);
  const showSkeleton = useSkeletonGate(state.status === "loading");
  return (
    <MyPathsView
      state={state}
      showSkeleton={showSkeleton}
      onRetry={paths.reload}
      onExplore={onExplore}
      onToggleStar={(item) => void paths.toggleStar(item.path.slug)}
    />
  );
}

/** The presentational part: everything it shows follows from its props. */
export function MyPathsView({
  state,
  showSkeleton,
  onRetry,
  onExplore,
  onToggleStar,
  initialFilter = "all",
}: {
  state: MineState;
  showSkeleton: boolean;
  onRetry: () => void;
  onExplore: () => void;
  /** Without it cards have no star. */
  onToggleStar?: (item: MyPath) => void;
  initialFilter?: MineFilter;
}) {
  const [filter, setFilter] = useState<MineFilter>(initialFilter);

  if (state.status === "loading") {
    return showSkeleton ? <MyPathsSkeleton /> : <div aria-busy="true" className="min-h-[40vh]" />;
  }
  if (state.status === "error") {
    return (
      <ErrorState
        level={2}
        title="We couldn’t load your paths"
        body="Your progress is safe. Try again in a moment."
      >
        <button type="button" onClick={onRetry} className={BUTTON_INVERSE}>
          Try again
        </button>
      </ErrorState>
    );
  }
  const { items } = state;
  if (!showMineFilters(items))
    return <MineEmpty filter="all" onExplore={onExplore} onFilter={setFilter} />;
  return (
    <MineList
      items={items}
      filter={filter}
      onFilter={setFilter}
      onExplore={onExplore}
      onToggleStar={onToggleStar}
    />
  );
}

function MineEmpty({
  filter,
  onExplore,
  onFilter,
}: {
  filter: MineFilter;
  onExplore: () => void;
  onFilter: (filter: MineFilter) => void;
}) {
  const copy = mineEmptyCopy(filter);
  return (
    <EmptyState title={copy.title} body={copy.body} art={filter === "completed" ? "done" : "paths"}>
      <button
        type="button"
        onClick={() => (copy.action.to === "explore" ? onExplore() : onFilter(copy.action.to))}
        className={BUTTON_PRIMARY}
      >
        {copy.action.label}
      </button>
    </EmptyState>
  );
}

function MineList({
  items,
  filter,
  onFilter,
  onExplore,
  onToggleStar,
}: {
  items: MyPath[];
  filter: MineFilter;
  onFilter: (filter: MineFilter) => void;
  onExplore: () => void;
  onToggleStar?: (item: MyPath) => void;
}) {
  const shown = useMemo(() => filterMine(items, filter), [items, filter]);
  const allPaths = useMemo(() => items.map((item) => item.path), [items]);
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="m-0 -mx-5 min-w-0 border-0 p-0 px-5 md:mx-0 md:px-0">
        <legend className="sr-only">Filter your paths</legend>
        <div className="-m-1 flex gap-2 overflow-x-auto p-1 md:flex-wrap md:overflow-visible">
          {MINE_FILTERS.map((option) => (
            <Chip
              key={option.value}
              active={option.value === filter}
              label={option.label}
              onClick={() => onFilter(option.value)}
            />
          ))}
        </div>
      </fieldset>
      <p
        role="status"
        aria-live="polite"
        className="font-medium text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]"
      >
        {mineCountLabel(shown.length)}
      </p>
      {shown.length > 0 ? (
        <PathGrid>
          {shown.map((item) => {
            const label = progressLabel(item);
            return (
              <PathCard
                key={item.path.slug}
                path={item.path}
                href={pathHref(item.path, allPaths)}
                progress={label ? { label, percent: percentDone(item) } : null}
                star={
                  onToggleStar
                    ? { starred: item.starred, onToggle: () => onToggleStar(item) }
                    : undefined
                }
              />
            );
          })}
        </PathGrid>
      ) : (
        <MineEmpty filter={filter} onExplore={onExplore} onFilter={onFilter} />
      )}
    </div>
  );
}
