"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  emptyFiltersCopy,
  type Filters,
  filterPaths,
  getCatalogueData,
  hasFilters,
  type LevelFilter,
  NO_FILTERS,
  normaliseQuery,
  pathCount,
  pathHref,
  pickedBanner,
  type TopicFilter,
} from "../../lib/app/paths-catalogue";
import { getCatalogue } from "../../lib/catalogue/data";
import { SparklesIcon } from "../app/icons";
import { useSession } from "../app/session";
import { LevelPopover, LevelSheet, TopicChips } from "./filters";
import { MyPaths } from "./my-paths";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  EmptyState,
  PathCard,
  PathGrid,
  SampleTag,
} from "./parts";
import { type PathsTab, PathsTabs, panelId, tabId } from "./paths-tabs";
import { SearchResults } from "./search-results";

/**
 * /learn/paths (Figma "Learning Paths": 1 Paths catalogue, 2 Filters match nothing, 3 Search
 * results, 4 Search no results; "New account" variants, since there is no progress data yet; and
 * the "My paths" tabs).
 *
 * The catalogue is static data read at build time (lib/catalogue), so it renders in one pass; the
 * only async part is reading ?q=, which useSearchParams does behind the Suspense boundary the page
 * provides (that boundary's fallback is the loading skeleton). Filters are plain React state: they
 * are not stored anywhere. Starring and progress need APIs that do not exist, so the star buttons
 * are left out and My paths is the honest empty state (see my-paths.tsx).
 */

const HEADING = "font-semibold text-[24px] text-text leading-8 tracking-[-0.24px] outline-none";
const COUNT = "font-medium text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]";

export function PathsCatalogue() {
  const params = useSearchParams();
  const query = normaliseQuery(params.get("q"));
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-7">
      {query ? <SearchResults query={query} /> : <Landing />}
    </div>
  );
}

/** The page with its Explore and My paths tabs. */
function Landing() {
  const [tab, setTab] = useState<PathsTab>("explore");
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className={HEADING}>Learning paths</h1>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px] md:text-[16px] md:leading-6 md:tracking-[-0.16px]">
          <span className="md:hidden">
            Structured paths built from the best free videos and articles.
          </span>
          <span className="hidden md:inline">
            Structured paths built from the best free videos and articles. Pick one and learn at
            your own pace.
          </span>
        </p>
      </header>

      <PathsTabs value={tab} onChange={setTab} />

      <div
        role="tabpanel"
        id={panelId(tab)}
        aria-labelledby={tabId(tab)}
        className="flex flex-col gap-7"
      >
        {tab === "explore" ? <Browse /> : <MyPaths onExplore={() => setTab("explore")} />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Catalogue (browse + filters)
// ---------------------------------------------------------------------------------------------

function Browse() {
  const { me } = useSession();
  const catalogue = getCatalogue();
  const data = useMemo(() => getCatalogueData(catalogue), [catalogue]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const shown = useMemo(() => filterPaths(data.paths, filters), [data.paths, filters]);
  const banner = useMemo(
    () => pickedBanner(data.paths, me.onboarding),
    [data.paths, me.onboarding],
  );
  const topicName = (slug: TopicFilter) =>
    slug === "all" ? null : (catalogue.topics.find((t) => t.slug === slug)?.name ?? null);
  const setLevel = (level: LevelFilter) => setFilters((f) => ({ ...f, level }));
  const countFor = (level: LevelFilter) =>
    filterPaths(data.paths, { topic: filters.topic, level }).length;

  return (
    <>
      {banner && !hasFilters(filters) ? (
        <section
          aria-label="Where to start"
          className="flex flex-col items-start gap-4 rounded-2xl border border-border-soft bg-bg-fill1 p-5 md:flex-row md:items-center"
        >
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-accent text-primary-text"
          >
            <SparklesIcon size={22} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
              {banner.title}
            </h2>
            <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              {banner.summary}
            </p>
          </div>
          <Link
            href={pathHref(banner.path, data.paths)}
            className={`${BUTTON_PRIMARY} w-full md:w-auto`}
          >
            View path
          </Link>
        </section>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <TopicChips
            topics={catalogue.topics}
            value={filters.topic}
            onChange={(topic) => setFilters((f) => ({ ...f, topic }))}
          />
          <LevelPopover className="hidden md:block" value={filters.level} onChange={setLevel} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p role="status" aria-live="polite" className={`${COUNT} flex items-center gap-2`}>
            {pathCount(shown.length)}
            {data.sample && shown.length > 0 ? <SampleTag /> : null}
          </p>
          <LevelSheet
            className="md:hidden"
            value={filters.level}
            onChange={setLevel}
            countFor={countFor}
          />
        </div>
      </div>

      {shown.length > 0 ? (
        <PathGrid>
          {shown.map((path) => (
            <PathCard key={path.slug} path={path} href={pathHref(path, data.paths)} />
          ))}
        </PathGrid>
      ) : data.paths.length === 0 ? (
        <EmptyState
          title="Paths are on their way"
          body="Learning paths will appear here as soon as the first ones are published."
        />
      ) : (
        <FiltersMatchNothing
          filters={filters}
          topicName={topicName(filters.topic)}
          onChange={setFilters}
        />
      )}
    </>
  );
}

function FiltersMatchNothing({
  filters,
  topicName,
  onChange,
}: {
  filters: Filters;
  topicName: string | null;
  onChange: (filters: Filters) => void;
}) {
  const copy = emptyFiltersCopy(filters, topicName);
  const run = (id: (typeof copy.actions)[number]["id"]) =>
    onChange(
      id === "clear"
        ? NO_FILTERS
        : id === "all-levels"
          ? { ...filters, level: "all" }
          : { ...filters, topic: "all" },
    );
  return (
    <EmptyState title={copy.title} body={copy.body}>
      {copy.actions.map((action, index) => (
        <button
          key={action.id}
          type="button"
          onClick={() => run(action.id)}
          className={index === copy.actions.length - 1 ? BUTTON_PRIMARY : BUTTON_SECONDARY}
        >
          {action.label}
        </button>
      ))}
    </EmptyState>
  );
}
