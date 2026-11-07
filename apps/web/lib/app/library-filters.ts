import type { LibraryItem, LibraryKind, LibraryPath } from "./library-data";

/**
 * Library filter, search and paging rules. Everything is in the URL (?q, topic, type, source,
 * page) so a filtered view can be shared and the top-bar search can link straight in. Unknown
 * values fall back to "all", so a stale link never leaves an impossible filter.
 */
export const PAGE_SIZE = 12;
export const MAX_QUERY = 100;

export type TypeFilter = "all" | LibraryKind;
export const TYPE_OPTIONS: { value: TypeFilter; label: string; plural: string }[] = [
  { value: "all", label: "All types", plural: "resources" },
  { value: "video", label: "Videos", plural: "videos" },
  { value: "article", label: "Articles", plural: "articles" },
  { value: "tool", label: "Tools", plural: "tools" },
];
const TYPES = new Set<string>(TYPE_OPTIONS.map((o) => o.value));

export type Filters = {
  /** Topic slug, or "all". */
  topic: string;
  type: TypeFilter;
  /** Source slug, or "all". */
  source: string;
  /** 1-based. */
  page: number;
};

export const NO_FILTERS: Filters = { topic: "all", type: "all", source: "all", page: 1 };

export type LibraryQuery = { q: string; filters: Filters };

type ParamsLike = { get(name: string): string | null };

export function parseQuery(
  params: ParamsLike,
  valid: { topics: readonly string[]; sources: readonly string[] },
): LibraryQuery {
  const topic = params.get("topic") ?? "all";
  const type = params.get("type") ?? "all";
  const source = params.get("source") ?? "all";
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY),
    filters: {
      topic: valid.topics.includes(topic) ? topic : "all",
      type: TYPES.has(type) ? (type as TypeFilter) : "all",
      source: valid.sources.includes(source) ? source : "all",
      page: Number.isFinite(page) && page > 1 ? page : 1,
    },
  };
}

/** Query string for a view ("" when it is the plain library). Defaults are left out. */
export function toSearchString({ q, filters }: LibraryQuery): string {
  const params = new URLSearchParams();
  const text = q.trim().slice(0, MAX_QUERY);
  if (text) params.set("q", text);
  if (filters.topic !== "all") params.set("topic", filters.topic);
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.source !== "all") params.set("source", filters.source);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

export function activeFilterCount(filters: Filters): number {
  return [filters.topic, filters.type, filters.source].filter((value) => value !== "all").length;
}

export function applyFilters(
  items: readonly LibraryItem[],
  filters: Pick<Filters, "topic" | "type" | "source">,
): LibraryItem[] {
  return items.filter(
    (item) =>
      (filters.topic === "all" || item.topicSlug === filters.topic) &&
      (filters.type === "all" || item.kind === filters.type) &&
      (filters.source === "all" || item.sourceSlug === filters.source),
  );
}

/** How many items each type has once topic and source are applied (the type list's counts). */
export function countByType(
  items: readonly LibraryItem[],
  filters: Pick<Filters, "topic" | "source">,
): Record<TypeFilter, number> {
  const scoped = applyFilters(items, { ...filters, type: "all" });
  return {
    all: scoped.length,
    video: scoped.filter((i) => i.kind === "video").length,
    article: scoped.filter((i) => i.kind === "article").length,
    tool: scoped.filter((i) => i.kind === "tool").length,
  };
}

const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

/** Every word must appear in the title, source, topic or type. Empty query matches everything. */
export function searchItems(items: readonly LibraryItem[], q: string): LibraryItem[] {
  const terms = words(q);
  if (terms.length === 0) return [...items];
  return items.filter((item) => {
    const hay = `${item.title} ${item.sourceName} ${item.topicName} ${item.kind}`.toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
}

export function searchPaths(
  paths: readonly LibraryPath[],
  q: string,
  topicName: (slug: string) => string,
): LibraryPath[] {
  const terms = words(q);
  if (terms.length === 0) return [...paths];
  return paths.filter((path) => {
    const hay = `${path.title} ${topicName(path.topicSlug)} ${path.level}`.toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
}

export type PageInfo = { page: number; pages: number; from: number; to: number; total: number };

/** The page clamped into range, plus the 1-based "Showing from-to of total" bounds. */
export function paginate(total: number, page: number, size: number = PAGE_SIZE): PageInfo {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  return {
    page: current,
    pages,
    from: total === 0 ? 0 : (current - 1) * size + 1,
    to: Math.min(current * size, total),
    total,
  };
}

/** Page buttons: first, last and the current page with its neighbours; "gap" stands for skipped pages. */
export function pageItems(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  const out: (number | "gap")[] = [];
  let last = 0;
  for (let n = 1; n <= pages; n++) {
    if (!keep.has(n)) continue;
    if (n - last > 1) out.push("gap");
    out.push(n);
    last = n;
  }
  return out;
}

/** Body text of the "Filters match nothing" state. */
export function emptyFiltersText(
  filters: Pick<Filters, "topic" | "type" | "source">,
  topicName: string,
): string {
  const plural = TYPE_OPTIONS.find((o) => o.value === filters.type)?.plural ?? "resources";
  const subject = filters.topic !== "all" ? `${topicName} ${plural}` : plural;
  const advice =
    filters.type !== "all"
      ? "Try another type, or clear the filters."
      : "Try clearing the filters.";
  return `There’s no ${subject} in the library yet. ${advice}`;
}
