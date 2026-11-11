"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { listResources, type ResourceQuery } from "../../lib/content/api";
import { durationLabel, metaLine, plural } from "../../lib/content/format";
import {
  LEVEL_OPTIONS,
  labelOf,
  STATUS_LABEL,
  TOPIC_OPTIONS,
  TYPE_OPTIONS,
} from "../../lib/content/options";
import type { ResourceCounts, ResourceRow } from "../../lib/content/types";
import { AddResourceModal } from "./add-resource-modal";
import { FixLinkModal } from "./fix-link-modal";
import { useDebounced, useSkeletonGate } from "./hooks";
import { useToast } from "./toast";
import {
  Badge,
  Button,
  CheckIcon,
  ChipTabs,
  Field,
  FiltersIcon,
  FOCUS,
  PageFrame,
  PageHeader,
  PlusIcon,
  SearchIcon,
  Select,
  Skeleton,
  StateMessage,
  TextInput,
  TypeChip,
  textActionClass,
} from "./ui";

type Tab = "all" | "live" | "draft" | "needs_fix" | "retired";
const EMPTY_COUNTS: ResourceCounts = {
  total: 0,
  live: 0,
  draft: 0,
  needsFix: 0,
  retired: 0,
  paths: 0,
};

/** Query sent to the API for a tab: spec D has tab=all|needs_fix plus a status filter. */
export function queryFor(
  tab: Tab,
  filters: { q: string; type: string; topic: string; level: string },
): ResourceQuery {
  return {
    tab: tab === "needs_fix" ? "needs_fix" : "all",
    status: tab === "all" || tab === "needs_fix" ? undefined : tab,
    q: filters.q.trim() || undefined,
    type: filters.type === "all" ? undefined : filters.type,
    topic: filters.topic === "all" ? undefined : filters.topic,
    level: filters.level === "all" ? undefined : filters.level,
    limit: 25,
  };
}

export function StatusBadge({ status }: { status: ResourceRow["status"] }) {
  const tone = status === "live" ? "success" : status === "needs_fix" ? "error" : "neutral";
  return (
    <Badge tone={tone}>
      {status === "live" ? <CheckIcon className="size-3" /> : null}
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const usedIn = (n: number) => (n === 0 ? "Library only" : plural(n, "path"));

export function ResourcesList() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [topic, setTopic] = useState("all");
  const [level, setLevel] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [adding, setAdding] = useState(params.get("add") === "1");
  const [fixing, setFixing] = useState<ResourceRow | null>(null);

  const debouncedQ = useDebounced(q, 300);
  const [items, setItems] = useState<ResourceRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<ResourceCounts>(EMPTY_COUNTS);
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "more">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [nonce, setNonce] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const showSkeleton = useSkeletonGate(phase === "loading");

  const query = queryFor(tab, { q: debouncedQ, type, topic, level });
  const queryKey = JSON.stringify(query);

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey carries the query
  useEffect(() => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setPhase("loading");
    listResources(query, ctrl.signal).then((result) => {
      if (ctrl.signal.aborted) return;
      if (!result.ok) {
        setErrorMessage(result.message);
        setPhase("error");
        return;
      }
      setItems(result.data.items);
      setCursor(result.data.nextCursor);
      setCounts(result.data.counts);
      setPhase("ready");
    });
    return () => ctrl.abort();
  }, [queryKey, nonce]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: query is derived from queryKey
  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setPhase("more");
    const result = await listResources({ ...query, cursor });
    if (!result.ok) {
      setPhase("ready");
      toast({ tone: "error", title: "Couldn’t load more", body: result.message });
      return;
    }
    setItems((all) => [...all, ...result.data.items]);
    setCursor(result.data.nextCursor);
    setPhase("ready");
  }, [cursor, queryKey, toast]);

  const filtered = q.trim() !== "" || type !== "all" || topic !== "all" || level !== "all";
  const clearFilters = () => {
    setQ("");
    setType("all");
    setTopic("all");
    setLevel("all");
  };
  const reload = () => setNonce((n) => n + 1);
  const closeAdd = () => {
    setAdding(false);
    if (params.get("add")) router.replace("/resources");
  };

  const subtitle =
    counts.total > 0 || phase === "ready"
      ? `${plural(counts.total, "resource")} across the library and ${plural(counts.paths, "path")}.`
      : "Everything learners can open, save and finish.";

  const tabs = [
    { value: "all" as const, label: "All", count: counts.total },
    { value: "live" as const, label: "Live", count: counts.live },
    { value: "draft" as const, label: "Draft", count: counts.draft },
    { value: "needs_fix" as const, label: "Needs fix", count: counts.needsFix },
    { value: "retired" as const, label: "Retired", count: counts.retired },
  ];

  return (
    <PageFrame>
      <PageHeader
        title="Resources"
        subtitle={subtitle}
        actions={
          <Button kind="primary" onClick={() => setAdding(true)}>
            <PlusIcon />
            Add resource
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <ChipTabs label="Resource status" value={tab} onChange={setTab} items={tabs} />
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <SearchIcon className="pointer-events-none absolute top-3 left-3 size-4 text-text-tertiary" />
            <TextInput
              type="search"
              aria-label="Search resources"
              placeholder="Search resources"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            aria-expanded={showFilters}
            aria-controls="resource-filters"
            onClick={() => setShowFilters((v) => !v)}
          >
            <FiltersIcon />
            Filters
          </Button>
        </div>
      </div>

      {showFilters ? (
        <div
          id="resource-filters"
          className="mt-3 grid gap-3 rounded-2xl border border-border-soft bg-bg-fill1 p-4 sm:grid-cols-4"
        >
          <Field label="Type">
            {({ id }) => (
              <Select id={id} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="all">All types</option>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Topic">
            {({ id }) => (
              <Select id={id} value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="all">All topics</option>
                {TOPIC_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Level">
            {({ id }) => (
              <Select id={id} value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="all">All levels</option>
                {LEVEL_OPTIONS.filter((o) => o.value !== "all").map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex items-end">
            <Button onClick={clearFilters} disabled={!filtered}>
              Clear filters
            </Button>
          </div>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {phase === "ready" ? `${plural(items.length, "resource")} shown` : ""}
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border-soft">
        {phase === "loading" && !showSkeleton ? (
          <div className="h-64" />
        ) : phase === "loading" ? (
          <ListSkeleton />
        ) : phase === "error" ? (
          <StateMessage
            tone="error"
            title="We couldn’t load resources"
            body={errorMessage || "Try again in a moment."}
            action={<Button onClick={reload}>Try again</Button>}
          />
        ) : items.length === 0 ? (
          <EmptyList
            tab={tab}
            filtered={filtered}
            onClear={clearFilters}
            onAdd={() => setAdding(true)}
          />
        ) : (
          <>
            <ResourceTable items={items} onFix={setFixing} />
            <ResourceCards items={items} onFix={setFixing} />
          </>
        )}
      </div>

      {cursor && (phase === "ready" || phase === "more") ? (
        <div className="mt-4 flex justify-center">
          <Button onClick={loadMore} busy={phase === "more"}>
            {phase === "more" ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}

      {adding ? <AddResourceModal onClose={closeAdd} /> : null}
      {fixing ? (
        <FixLinkModal
          resourceId={fixing.id}
          title={fixing.title}
          onClose={() => setFixing(null)}
          onDone={(message) => {
            setFixing(null);
            toast({ tone: "success", title: message });
            reload();
          }}
        />
      ) : null}
    </PageFrame>
  );
}

function EmptyList({
  tab,
  filtered,
  onClear,
  onAdd,
}: {
  tab: Tab;
  filtered: boolean;
  onClear: () => void;
  onAdd: () => void;
}) {
  if (filtered)
    return (
      <StateMessage
        title="No resources match"
        body="Try another word or clear the filters."
        action={<Button onClick={onClear}>Clear filters</Button>}
      />
    );
  if (tab === "needs_fix")
    return <StateMessage title="Nothing to fix" body="Every link passed today’s check." />;
  return (
    <StateMessage
      title={tab === "all" ? "No resources yet" : `No ${STATUS_LABEL[tab].toLowerCase()} resources`}
      body={
        tab === "all"
          ? "Add the first one: paste a link and we’ll check it."
          : "Resources in this state show up here."
      }
      action={
        tab === "all" ? (
          <Button kind="primary" onClick={onAdd}>
            <PlusIcon />
            Add resource
          </Button>
        ) : undefined
      }
    />
  );
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading resources" className="divide-y divide-border-soft">
      {Array.from({ length: 7 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
        <div key={i} className="flex items-center gap-6 px-4 py-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-5 w-16 md:block" />
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  );
}

function RowAction({ row, onFix }: { row: ResourceRow; onFix: (r: ResourceRow) => void }) {
  if (row.status === "needs_fix")
    return (
      <button
        type="button"
        onClick={() => onFix(row)}
        aria-label={`Fix ${row.title}`}
        className={`${textActionClass} font-medium text-error-text`}
      >
        Fix
      </button>
    );
  return (
    <Link
      href={`/resources/detail?id=${encodeURIComponent(row.id)}`}
      aria-label={`Open ${row.title}`}
      className={textActionClass}
    >
      Open
    </Link>
  );
}

function TitleCell({ row }: { row: ResourceRow }) {
  return (
    <div className="min-w-0">
      <Link
        href={`/resources/detail?id=${encodeURIComponent(row.id)}`}
        className={`block truncate rounded-sm font-medium text-[14px] leading-5 hover:underline ${FOCUS}`}
      >
        {row.title}
      </Link>
      <p className="truncate text-[12px] text-text-tertiary leading-4">
        {row.problem ??
          metaLine([row.source || row.creator, durationLabel(row.durationMin, row.type)])}
      </p>
    </div>
  );
}

function ResourceTable({
  items,
  onFix,
}: {
  items: ResourceRow[];
  onFix: (r: ResourceRow) => void;
}) {
  return (
    <table className="hidden w-full table-fixed text-left text-[14px] md:table">
      <caption className="sr-only">Resources</caption>
      <thead className="bg-bg-fill1 text-text-secondary">
        <tr>
          <th scope="col" className="w-[34%] px-4 py-3 font-normal">
            Resource
          </th>
          <th scope="col" className="w-[9%] py-3 font-normal">
            Type
          </th>
          <th scope="col" className="w-[14%] py-3 font-normal">
            Topic
          </th>
          <th scope="col" className="w-[11%] py-3 font-normal">
            Level
          </th>
          <th scope="col" className="w-[11%] py-3 font-normal">
            Used in
          </th>
          <th scope="col" className="w-[11%] py-3 font-normal">
            Status
          </th>
          <th scope="col" className="w-[10%] py-3 pr-4 font-normal">
            <span className="sr-only">Action</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-soft">
        {items.map((row) => (
          <tr key={row.id} className="hover:bg-bg-fill1">
            <td className="px-4 py-3">
              <TitleCell row={row} />
            </td>
            <td className="py-3">
              <TypeChip type={row.type} />
            </td>
            <td className="truncate py-3 pr-2">{row.topic || "—"}</td>
            <td className="py-3">{labelOf(LEVEL_OPTIONS, row.level)}</td>
            <td className="py-3">{usedIn(row.usedInPaths)}</td>
            <td className="py-3">
              <StatusBadge status={row.status} />
            </td>
            <td className="py-3 pr-4">
              <RowAction row={row} onFix={onFix} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ResourceCards({
  items,
  onFix,
}: {
  items: ResourceRow[];
  onFix: (r: ResourceRow) => void;
}) {
  return (
    <ul className="divide-y divide-border-soft md:hidden">
      {items.map((row) => (
        <li key={row.id} className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <TitleCell row={row} />
            <RowAction row={row} onFix={onFix} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-secondary">
            <TypeChip type={row.type} />
            <StatusBadge status={row.status} />
            <span>{row.topic || "—"}</span>
            <span>{labelOf(LEVEL_OPTIONS, row.level)}</span>
            <span>{usedIn(row.usedInPaths)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
