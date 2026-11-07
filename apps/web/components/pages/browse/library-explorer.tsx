"use client";

import { useState } from "react";
import {
  type BrowseResource,
  filterOf,
  TYPE_FILTERS,
  type TypeFilter,
} from "../../../lib/pages/browse-library";
import { PageHero } from "./page-hero";
import { ResourceCard } from "./resource-card";

const CHIP =
  "rounded-md px-1.5 py-1 font-medium text-[14px] leading-5 tracking-[-0.14px] transition-colors";

/**
 * Library hero (with the search field) plus the filtered grid, in one client component so the
 * search box and the type chips drive the same list. Returns two sections for <main>.
 */
export function LibraryExplorer({
  resources,
  totalLabel,
}: {
  resources: BrowseResource[];
  totalLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const q = query.trim().toLowerCase();
  const shown = resources.filter(
    (r) =>
      (type === "all" || filterOf(r.format) === type) &&
      (q === "" || `${r.title} ${r.sourceName} ${r.topicName}`.toLowerCase().includes(q)),
  );

  return (
    <>
      <PageHero
        id="library-heading"
        eyebrow="Resource library"
        title="A free library of design and dev resources"
        intro="Videos, articles, docs and tools, tagged by topic, format and source. Search for exactly what you need."
      >
        <form
          aria-label="Search the library"
          onSubmit={(event) => event.preventDefault()}
          className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-border-soft bg-bg-base px-3 focus-within:border-primary-border md:w-[560px]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            className="size-[18px] shrink-0 text-text-tertiary"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search resources"
            placeholder={`Search ${totalLabel} free resources`}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary"
          />
        </form>
      </PageHero>

      <section
        aria-labelledby="resources-heading"
        className="border-border-soft border-t px-5 lg:px-8"
      >
        <div className="mx-auto flex max-w-[1240px] flex-col gap-10 border-border-soft border-r border-l px-4 py-12 md:px-10 xl:py-24">
          <h2 id="resources-heading" className="sr-only">
            Resources
          </h2>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
              <legend className="sr-only">Filter by type</legend>
              {TYPE_FILTERS.map((filter) => {
                const active = filter.value === type;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setType(filter.value)}
                    className={`${CHIP} ${
                      active
                        ? "bg-primary-focus text-primary-text"
                        : "border border-border-soft-alpha text-text-secondary hover:bg-bg-fill1"
                    }`}
                  >
                    <span className="px-0.5">{filter.label}</span>
                  </button>
                );
              })}
            </fieldset>
            <p
              aria-live="polite"
              className="shrink-0 whitespace-nowrap font-mono text-[12px] text-text-tertiary uppercase tracking-[0.72px] md:pt-1.5"
            >
              {shown.length} of {totalLabel} resources
            </p>
          </div>

          {shown.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-border-soft bg-bg-fill1 p-8 text-center text-[16px] text-text-secondary leading-6">
              No resources match your search.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
