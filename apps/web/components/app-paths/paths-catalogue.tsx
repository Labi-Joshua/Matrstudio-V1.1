"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useId, useMemo, useState } from "react";
import {
  buildSearchView,
  emptyFiltersCopy,
  type Filters,
  filterPaths,
  getCatalogueData,
  hasFilters,
  LEVEL_LABEL,
  LEVELS,
  type LevelFilter,
  NO_FILTERS,
  normaliseQuery,
  pathCount,
  pathHref,
  pickedBanner,
  type ResultType,
  type SearchView,
  type TopicFilter,
  visibleSections,
} from "../../lib/app/paths-catalogue";
import { getCatalogue } from "../../lib/catalogue/data";
import { filterOf, getLibraryData, TYPE_LABEL } from "../../lib/pages/browse-library";
import { USE_SAMPLE_WHEN_EMPTY } from "../../lib/pages/topic-content";
import { ROUTES } from "../../lib/routes";
import { usePopover } from "../app/hooks";
import { ChevronDownIcon, SearchIcon, SparklesIcon } from "../app/icons";
import { useSession } from "../app/session";
import { FOCUS } from "../app/ui";
import { ExternalLinkIcon, WrenchIcon } from "./icons";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  EmptyState,
  PathCard,
  PathGrid,
  SampleTag,
} from "./parts";

/**
 * /learn/paths (Figma "Learning Paths": 1 Paths catalogue, 2 Filters match nothing, 3 Search
 * results, 4 Search no results; "New account" variants, since there is no progress data yet).
 *
 * The catalogue is static data read at build time (lib/catalogue), so it renders in one pass; the
 * only async part is reading ?q=, which useSearchParams does behind the Suspense boundary the page
 * provides (that boundary's fallback is the loading skeleton). Filters are plain React state: they
 * are not stored anywhere. Starring, "My paths" and progress need APIs that do not exist, so the
 * star buttons are left out and the "My paths" tab is disabled.
 */

const HEADING = "font-semibold text-[24px] text-text leading-8 tracking-[-0.24px] outline-none";
const COUNT = "font-medium text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]";

export function PathsCatalogue() {
  const params = useSearchParams();
  const query = normaliseQuery(params.get("q"));
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-7">
      {query ? <SearchResults query={query} /> : <Browse />}
    </div>
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

      <PathsTabs />

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
          <LevelMenu
            className="hidden md:block"
            variant="level"
            value={filters.level}
            onChange={(level) => setFilters((f) => ({ ...f, level }))}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p role="status" aria-live="polite" className={`${COUNT} flex items-center gap-2`}>
            {pathCount(shown.length)}
            {data.sample && shown.length > 0 ? <SampleTag /> : null}
          </p>
          <LevelMenu
            className="md:hidden"
            variant="filters"
            value={filters.level}
            onChange={(level) => setFilters((f) => ({ ...f, level }))}
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

/** "Explore / My paths" tabs. My paths needs progress and starred paths, so it is disabled. */
function PathsTabs() {
  const tab =
    "-mb-px flex items-center border-b-2 px-1 py-2.5 text-[14px] leading-5 tracking-[-0.14px]";
  return (
    <nav aria-label="Paths" className="flex gap-3 border-border-alpha border-b">
      <Link
        href={ROUTES.app.paths}
        aria-current="page"
        className={`${tab} rounded-t-md border-primary font-medium text-text ${FOCUS}`}
      >
        <span className="px-0.5">Explore</span>
      </Link>
      <button
        type="button"
        disabled
        title="Coming soon"
        className={`${tab} cursor-not-allowed border-transparent font-medium text-text-secondary opacity-60`}
      >
        <span className="px-0.5">My paths</span>
      </button>
    </nav>
  );
}

/** Topic filter chips (a button group: each chip is aria-pressed). The row scrolls on phones. */
function TopicChips({
  topics,
  value,
  onChange,
}: {
  topics: { slug: string; name: string }[];
  value: TopicFilter;
  onChange: (topic: TopicFilter) => void;
}) {
  const chips: { slug: TopicFilter; name: string }[] = [
    { slug: "all", name: "All" },
    ...topics.map((t) => ({ slug: t.slug as TopicFilter, name: t.name })),
  ];
  return (
    <fieldset className="m-0 -mx-5 min-w-0 flex-1 border-0 p-0 px-5 md:mx-0 md:px-0">
      <legend className="sr-only">Filter paths by topic</legend>
      <div className="-m-1 flex gap-2 overflow-x-auto p-1 md:flex-wrap md:overflow-visible">
        {chips.map((chip) => (
          <Chip
            key={chip.slug}
            active={chip.slug === value}
            onClick={() => onChange(chip.slug)}
            label={chip.name}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-[14px] leading-5 tracking-[-0.14px] transition-colors ${FOCUS} ${
        active
          ? "bg-text text-bg-base"
          : "border border-border-soft text-text-secondary hover:bg-bg-fill1 hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * The level filter: a button that opens a small panel of options. Desktop shows "Level: All
 * levels"; phones show "Filters" (with "· 1" once a level is chosen), as in the mobile frames.
 */
function LevelMenu({
  value,
  onChange,
  variant,
  className = "",
}: {
  value: LevelFilter;
  onChange: (level: LevelFilter) => void;
  variant: "level" | "filters";
  className?: string;
}) {
  const { open, setOpen, toggle, buttonRef, panelRef } = usePopover();
  const id = useId();
  const options: { value: LevelFilter; label: string }[] = [
    { value: "all", label: "All levels" },
    ...LEVELS.map((level) => ({ value: level, label: LEVEL_LABEL[level] })),
  ];
  const label =
    variant === "level"
      ? `Level: ${value === "all" ? "All levels" : LEVEL_LABEL[value]}`
      : value === "all"
        ? "Filters"
        : "Filters · 1";
  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevation-1 px-2.5 py-2 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] shadow-e1 ${FOCUS}`}
      >
        <span className="px-0.5">{label}</span>
        <ChevronDownIcon size={20} />
      </button>
      {open ? (
        <div
          id={id}
          ref={panelRef}
          className="absolute top-full right-0 z-20 mt-2 w-[200px] rounded-lg border border-border-soft bg-bg-base p-2 shadow-e2"
        >
          <fieldset className="m-0 flex flex-col gap-0.5 border-0 p-0">
            <legend className="px-2 pt-1 pb-1.5 font-medium text-[12px] text-text-tertiary leading-4">
              Level
            </legend>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`rounded-md px-2 py-1.5 text-left font-medium text-[14px] leading-5 tracking-[-0.14px] ${FOCUS} ${
                    active ? "bg-primary-focus text-primary-text" : "text-text hover:bg-bg-fill1"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </fieldset>
        </div>
      ) : null}
    </div>
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

// ---------------------------------------------------------------------------------------------
// Search results (?q=)
// ---------------------------------------------------------------------------------------------

function SearchResults({ query }: { query: string }) {
  const catalogue = getCatalogue();
  const [type, setType] = useState<ResultType>("all");
  const data = useMemo(() => getCatalogueData(catalogue), [catalogue]);
  const library = useMemo(() => {
    const lib = getLibraryData(catalogue);
    return lib.isSample && !USE_SAMPLE_WHEN_EMPTY ? { ...lib, resources: [] } : lib;
  }, [catalogue]);
  const view = useMemo(
    () =>
      buildSearchView(
        query,
        data.paths,
        library.resources,
        (slug) => catalogue.topics.find((t) => t.slug === slug)?.name ?? slug,
      ),
    [query, data.paths, library.resources, catalogue],
  );
  const show = visibleSections(view, type);
  const sample =
    (data.sample && view.paths.length > 0) || (library.isSample && view.resources.length > 0);

  return (
    <>
      <SearchField initial={query} />
      <header className="flex flex-col gap-2">
        <h1 className={HEADING}>Results for “{query}”</h1>
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-[14px] text-text-secondary leading-5 tracking-[-0.14px] md:text-[16px] md:leading-6 md:tracking-[-0.16px]"
        >
          {view.summary}
          {sample ? <SampleTag /> : null}
        </p>
      </header>

      {view.total === 0 ? (
        <EmptyState
          title={`No results for “${query}”`}
          body="Check the spelling or try a different word, such as a topic like UI/UX or SEO."
        >
          <Link href={ROUTES.app.paths} className={BUTTON_PRIMARY}>
            Browse all paths
          </Link>
        </EmptyState>
      ) : (
        <>
          <ResultTypeChips view={view} value={type} onChange={setType} />
          {show.paths ? (
            <section aria-labelledby="results-paths" className="flex flex-col gap-3.5">
              <h2 id="results-paths" className={EYEBROW}>
                Paths
              </h2>
              <PathGrid>
                {view.paths.map((path) => (
                  <PathCard key={path.slug} path={path} href={pathHref(path, data.paths)} />
                ))}
              </PathGrid>
            </section>
          ) : null}
          {show.resources ? (
            <section aria-labelledby="results-resources" className="flex flex-col gap-3.5">
              <h2 id="results-resources" className={EYEBROW}>
                Resources
              </h2>
              <ul className="m-0 flex max-w-[960px] list-none flex-col gap-2.5 p-0">
                {view.resources.map((resource) => (
                  <ResourceRow key={resource.id} resource={resource} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

const EYEBROW = "font-mono text-[12px] text-text-tertiary uppercase leading-4 tracking-[0.72px]";

/** The in-page search box. The top bar hides its own field below xl, so phones get this one. */
function SearchField({ initial }: { initial: string }) {
  const router = useRouter();
  const id = useId();
  const [text, setText] = useState(initial);
  function submit(event: FormEvent) {
    event.preventDefault();
    const q = normaliseQuery(text);
    router.push(q ? `${ROUTES.app.paths}?q=${encodeURIComponent(q)}` : ROUTES.app.paths);
  }
  return (
    <search className="xl:hidden">
      <form
        onSubmit={submit}
        className="flex h-10 items-center gap-2 rounded-[10px] border border-border-soft bg-bg-base px-3 focus-within:border-primary-border"
      >
        <SearchIcon size={18} className="shrink-0 text-text-tertiary" />
        <label htmlFor={id} className="sr-only">
          Search paths and resources
        </label>
        <input
          id={id}
          type="search"
          value={text}
          maxLength={100}
          onChange={(event) => setText(event.target.value)}
          placeholder="Search paths and resources"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-text leading-5 outline-none placeholder:text-text-tertiary"
        />
      </form>
    </search>
  );
}

function ResultTypeChips({
  view,
  value,
  onChange,
}: {
  view: SearchView;
  value: ResultType;
  onChange: (type: ResultType) => void;
}) {
  const chips: { value: ResultType; label: string }[] = [
    { value: "all", label: `All ${view.total}` },
    { value: "paths", label: `Paths ${view.paths.length}` },
    { value: "resources", label: `Resources ${view.resources.length}` },
  ];
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">Result type</legend>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Chip
            key={chip.value}
            active={chip.value === value}
            label={chip.label}
            onClick={() => onChange(chip.value)}
          />
        ))}
      </div>
    </fieldset>
  );
}

const TYPE_BADGE = {
  video: "bg-error-focus text-error-text",
  article: "bg-[color-mix(in_srgb,var(--matr-blue)_16%,var(--matr-bg-base))] text-utility-blue",
  tool: "bg-[color-mix(in_srgb,var(--matr-emerald)_16%,var(--matr-bg-base))] text-utility-emerald",
} as const;

/** Resource Row (Figma): type tile, title, "Video · 15:04 · YouTube", type badge, external link. */
function ResourceRow({
  resource,
}: {
  resource: ReturnType<typeof getLibraryData>["resources"][number];
}) {
  const type = filterOf(resource.format);
  const body = (
    <>
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary"
      >
        {type === "tool" ? (
          <WrenchIcon size={20} />
        ) : (
          <span className="font-semibold text-[14px]">{resource.sourceName.charAt(0)}</span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold text-[14px] text-text leading-5 tracking-[-0.14px]">
          {resource.title}
        </span>
        <span className="text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          {[TYPE_LABEL[type], resource.lengthLabel, resource.sourceName]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span
        className={`rounded-md px-1.5 py-[3px] font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${TYPE_BADGE[type]}`}
      >
        {TYPE_LABEL[type]}
      </span>
      {resource.url ? <ExternalLinkIcon size={18} className="shrink-0 text-primary-text" /> : null}
    </>
  );
  const box =
    "flex items-center gap-3 rounded-xl border border-border-soft bg-bg-base py-3 pr-3.5 pl-3";
  return (
    <li>
      {resource.url ? (
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${box} hover:border-primary-border ${FOCUS}`}
        >
          {body}
          <span className="sr-only"> (opens the original source in a new tab)</span>
        </a>
      ) : (
        <div className={box}>{body}</div>
      )}
    </li>
  );
}
