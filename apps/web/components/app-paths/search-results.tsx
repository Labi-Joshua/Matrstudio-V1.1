"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useMemo, useState } from "react";
import {
  buildSearchView,
  getCatalogueData,
  normaliseQuery,
  pathHref,
  type ResultType,
  type SearchView,
  visibleSections,
} from "../../lib/app/paths-catalogue";
import { getCatalogue } from "../../lib/catalogue/data";
import { filterOf, getLibraryData, TYPE_LABEL } from "../../lib/pages/browse-library";
import { USE_SAMPLE_WHEN_EMPTY } from "../../lib/pages/topic-content";
import { ROUTES } from "../../lib/routes";
import { SearchIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { Chip } from "./filters";
import { ExternalLinkIcon, WrenchIcon } from "./icons";
import { BUTTON_PRIMARY, EmptyState, PathCard, PathGrid, SampleTag } from "./parts";

/** Search results (Figma "3. Search results", "4. Search: no results"), shown when ?q= is set. */

const HEADING = "font-semibold text-[24px] text-text leading-8 tracking-[-0.24px] outline-none";

export function SearchResults({ query }: { query: string }) {
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
