"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useMemo, useRef, useState } from "react";
import { buildLibraryModel, type LibraryModel, type LibraryPath } from "../../lib/app/library-data";
import {
  applyFilters,
  emptyFiltersText,
  type Filters,
  type LibraryQuery,
  NO_FILTERS,
  pageItems,
  paginate,
  parseQuery,
  searchItems,
  searchPaths,
  toSearchString,
} from "../../lib/app/library-filters";
import { getCatalogue } from "../../lib/catalogue/data";
import { LEVEL_TEXT } from "../../lib/pages/browse-library";
import { ROUTES } from "../../lib/routes";
import { SearchIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { BookIcon, PathCover, TOPIC_LOOK } from "../landing/at-work-art";
import { SampleTag } from "./art";
import { Chip, SelectMenu, TopicChips, typeOptions } from "./filters";
import { FilterSheet } from "./filters-sheet";
import { LibraryCard } from "./resource-card";
import { BackLink, BTN_PRIMARY, BTN_SECONDARY, PageHeader, StateBlock } from "./ui";

const INTRO =
  "Free videos, articles and tools picked by our curators. Search or filter to find what you need.";
const topicNameOf = (model: LibraryModel, slug: string) =>
  model.topics.find((t) => t.slug === slug)?.name ?? "";
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * /learn/library: the Figma Library screens. Topic chips plus Type and Source menus (a Filters
 * sheet on phones) narrow the grid; `?q=` (from the top-bar search) switches to the search results
 * view. Filter, search and page all live in the URL, so a view can be shared and Back works.
 * Rendered inside <Suspense> by the page (useSearchParams in a static export).
 */
export function LibraryView() {
  const model = useMemo(() => buildLibraryModel(getCatalogue()), []);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const view = useMemo(
    () =>
      parseQuery(params, {
        topics: model.topics.map((t) => t.slug),
        sources: model.sources.map((s) => s.slug),
      }),
    [params, model],
  );

  const go = useCallback(
    (next: LibraryQuery) => {
      const qs = toSearchString(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      <PhoneSearch key={view.q} q={view.q} onSubmit={(q) => go({ q, filters: NO_FILTERS })} />
      {view.q ? (
        <SearchResults model={model} q={view.q} />
      ) : (
        <Browse
          model={model}
          filters={view.filters}
          onChange={(filters) => go({ q: "", filters })}
        />
      )}
    </div>
  );
}

/** The top bar's search field collapses to an icon below xl, so the page carries its own field there. */
function PhoneSearch({ q, onSubmit }: { q: string; onSubmit: (q: string) => void }) {
  const [value, setValue] = useState(q);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(value.trim());
  }
  return (
    <search className="xl:hidden">
      <form
        onSubmit={submit}
        className="flex h-10 items-center gap-2 rounded-[10px] border border-border-soft bg-bg-base px-3 focus-within:border-primary-border"
      >
        <SearchIcon size={18} className="shrink-0 text-text-tertiary" />
        <input
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={100}
          autoComplete="off"
          aria-label="Search paths and resources"
          placeholder="Search paths and resources"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary"
        />
      </form>
    </search>
  );
}

function Browse({
  model,
  filters,
  onChange,
}: {
  model: LibraryModel;
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const matches = useMemo(() => applyFilters(model.items, filters), [model.items, filters]);
  const info = paginate(matches.length, filters.page);
  const shown = matches.slice(info.from - 1 < 0 ? 0 : info.from - 1, info.to);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch, page: 1 });
  const sourceOptions = [
    { value: "all", label: "All sources" },
    ...model.sources.map((s) => ({ value: s.slug, label: s.name })),
  ];

  return (
    <>
      <PageHeader
        title="Library"
        headingRef={headingRef}
        intro={INTRO}
        aside={model.sample ? <SampleTag /> : undefined}
      />

      {model.items.length === 0 ? (
        <StateBlock
          glyph="filter"
          title="No resources yet"
          body="Resources will show up here once our curators add them."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <TopicChips
                topics={model.topics}
                value={filters.topic}
                onChange={(topic) => set({ topic })}
                className="flex-1"
              />
              <div className="hidden shrink-0 items-center gap-2 md:flex">
                <SelectMenu
                  label="Type"
                  options={typeOptions()}
                  value={filters.type}
                  onChange={(type) => set({ type: type as Filters["type"] })}
                />
                {model.sources.length > 1 ? (
                  <SelectMenu
                    label="Source"
                    options={sourceOptions}
                    value={filters.source}
                    onChange={(source) => set({ source })}
                  />
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p
                aria-live="polite"
                aria-atomic="true"
                className="text-[13px] text-text-tertiary leading-5 tracking-[-0.13px]"
              >
                {matches.length === 0
                  ? "0 resources"
                  : `Showing ${info.from}–${info.to} of ${info.total} ${plural(info.total, "resource", "resources")}`}
              </p>
              <div className="md:hidden">
                <FilterSheet model={model} filters={filters} onApply={(next) => onChange(next)} />
              </div>
            </div>
          </div>

          {matches.length === 0 ? (
            <StateBlock
              glyph="filter"
              title="No resources match these filters"
              body={emptyFiltersText(filters, topicNameOf(model, filters.topic))}
            >
              <button type="button" onClick={() => onChange(NO_FILTERS)} className={BTN_SECONDARY}>
                Clear filters
              </button>
              {filters.type !== "all" ? (
                <button type="button" onClick={() => set({ type: "all" })} className={BTN_PRIMARY}>
                  Show all types
                </button>
              ) : null}
            </StateBlock>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {shown.map((item) => (
                <li key={item.id}>
                  <LibraryCard item={item} />
                </li>
              ))}
            </ul>
          )}

          {info.pages > 1 ? (
            <Pagination
              page={info.page}
              pages={info.pages}
              onPage={(page) => {
                onChange({ ...filters, page });
                // Same heading stays mounted, so focus can move right away: keyboard and screen reader users restart at the top.
                headingRef.current?.focus();
              }}
            />
          ) : null}
        </>
      )}
    </>
  );
}

function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  const btn = `flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-[14px] leading-5 tracking-[-0.14px] ${FOCUS}`;
  const idle = "border-border-soft text-text-secondary hover:bg-bg-fill1 hover:text-text";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={`${btn} ${idle} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        Previous
      </button>
      <ul className="m-0 hidden list-none items-center gap-1 p-0 sm:flex">
        {pageItems(page, pages).map((item, index) =>
          item === "gap" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: gaps have no identity
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-text-tertiary">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                onClick={() => onPage(item)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
                className={`${btn} ${item === page ? "border-primary-border bg-primary-accent text-primary-text" : idle}`}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ul>
      <span className="text-[13px] text-text-tertiary sm:hidden">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className={`${btn} ${idle} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        Next
      </button>
    </nav>
  );
}

const LEVEL_CLASS = {
  beginner: "bg-success-focus text-success-text",
  intermediate: "bg-warning-focus text-warning-text",
  advanced: "bg-error-focus text-error-text",
};

function PathResult({ path }: { path: LibraryPath }) {
  return (
    <Link
      href={ROUTES.app.pathTopic(path.topicSlug)}
      className={`card-lift flex h-full flex-col overflow-clip rounded-2xl border border-border-soft bg-bg-base ${FOCUS}`}
    >
      <PathCover topic={path.topicSlug} hue={TOPIC_LOOK[path.topicSlug].cover} />
      <span className="flex flex-col items-start gap-2 px-4 pt-4 pb-[18px]">
        <span className={`rounded-md px-1.5 py-[3px] ${LEVEL_CLASS[path.level]}`}>
          <span className="block px-0.5 font-medium text-[13px] leading-[18px] tracking-[-0.13px]">
            {LEVEL_TEXT[path.level]}
          </span>
        </span>
        <span className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
          {path.title}
        </span>
        <span className="flex items-center gap-1 font-medium text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          <BookIcon />
          {path.lessons} {plural(path.lessons, "lesson", "lessons")}
        </span>
      </span>
    </Link>
  );
}

type Scope = "all" | "paths" | "resources";

/** Figma "Search results": counts line, All / Paths / Resources tabs, then the two groups. */
function SearchResults({ model, q }: { model: LibraryModel; q: string }) {
  const [scope, setScope] = useState<Scope>("all");
  const items = useMemo(() => searchItems(model.items, q), [model.items, q]);
  const paths = useMemo(
    () => searchPaths(model.paths, q, (slug) => topicNameOf(model, slug)),
    [model, q],
  );
  const total = items.length + paths.length;
  const showPaths = scope !== "resources" && paths.length > 0;
  const showItems = scope !== "paths" && items.length > 0;
  const tabs: { value: Scope; label: string; count: number }[] = [
    { value: "all", label: "All", count: total },
    { value: "paths", label: "Paths", count: paths.length },
    { value: "resources", label: "Resources", count: items.length },
  ];

  return (
    <>
      <BackLink href={ROUTES.app.library}>Back to the library</BackLink>
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="break-words font-medium text-[28px] text-text leading-9 tracking-[-0.56px] md:text-[32px] md:leading-10 md:tracking-[-0.64px]">
            Results for “{q}”
          </h1>
          {model.sample ? <SampleTag /> : null}
        </div>
        <p
          aria-live="polite"
          aria-atomic="true"
          className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]"
        >
          {paths.length} {plural(paths.length, "path", "paths")} and {items.length}{" "}
          {plural(items.length, "resource", "resources")}
        </p>
      </header>

      {total === 0 ? (
        <StateBlock
          glyph="search"
          title={`No results for “${q}”`}
          body="We focus on design and development topics. Try another word, or suggest a resource we should add."
        >
          <Link href={ROUTES.app.library} className={BTN_SECONDARY}>
            Clear search
          </Link>
          <Link href={ROUTES.app.submit} className={BTN_PRIMARY}>
            Suggest a resource
          </Link>
        </StateBlock>
      ) : (
        <>
          <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
            <legend className="sr-only">Show</legend>
            {tabs.map((tab) => (
              <Chip
                key={tab.value}
                active={scope === tab.value}
                onClick={() => setScope(tab.value)}
              >
                {tab.label} {tab.count}
              </Chip>
            ))}
          </fieldset>

          {showPaths ? (
            <section aria-labelledby="results-paths" className="flex flex-col gap-3">
              <h2
                id="results-paths"
                className="font-mono text-[12px] text-text-tertiary uppercase leading-4 tracking-[0.72px]"
              >
                Paths
              </h2>
              <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {paths.map((path) => (
                  <li key={path.slug}>
                    <PathResult path={path} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {showItems ? (
            <section aria-labelledby="results-resources" className="flex flex-col gap-3">
              <h2
                id="results-resources"
                className="font-mono text-[12px] text-text-tertiary uppercase leading-4 tracking-[0.72px]"
              >
                Resources
              </h2>
              <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {items.map((item) => (
                  <li key={item.id}>
                    <LibraryCard item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
