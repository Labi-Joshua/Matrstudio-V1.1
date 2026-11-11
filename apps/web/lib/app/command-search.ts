import type { Catalogue } from "../catalogue/types";
import { TYPE_LABEL } from "../pages/browse-library";
import { ROUTES } from "../routes";
import { COMMAND_PAGES, type CommandAction, type CommandIcon } from "./command-items";
import { normaliseCommandQuery, queryTerms, rankItems } from "./command-match";
import { buildLibraryModel, type LibraryKind } from "./library-data";
import { getCatalogueData, LEVEL_LABEL, pathHref } from "./paths-catalogue";

/**
 * What the command palette lists, from the static catalogue and the page list (no server search
 * exists): an index built once, then pure functions that turn a query into grouped rows.
 */
export type CommandGroupId = "jump" | "recent" | "paths" | "resources" | "pages";

export type CommandRow = {
  /** Unique across the whole list; used for the option element ids. */
  id: string;
  group: CommandGroupId;
  title: string;
  /** Second line: "UI/UX · Beginner", "YouTube · 12 min", ... */
  meta: string;
  icon: CommandIcon | "recent" | "clear" | "all";
  kind?: LibraryKind;
  typeLabel?: string;
  sample: boolean;
  action: CommandAction;
};

export type CommandGroup = { id: CommandGroupId; label: string; rows: CommandRow[] };

type IndexedRow = CommandRow & { secondary: string[] };

export type CommandIndex = {
  paths: IndexedRow[];
  resources: IndexedRow[];
  sample: boolean;
};

export const GROUP_LIMITS = { paths: 4, resources: 6, pages: 5 } as const;

const GROUP_LABEL: Record<CommandGroupId, string> = {
  jump: "Jump to",
  recent: "Recent searches",
  paths: "Paths",
  resources: "Library resources",
  pages: "Pages and actions",
};

export function buildCommandIndex(catalogue: Catalogue): CommandIndex {
  const library = buildLibraryModel(catalogue);
  const topicName = new Map(catalogue.topics.map((t) => [t.slug, t.name]));
  const { paths, sample: pathsSample } = getCatalogueData(catalogue);
  return {
    sample: library.sample || pathsSample,
    paths: paths.map((path) => {
      const topic = topicName.get(path.topicSlug) ?? "";
      return {
        id: `path-${path.slug}`,
        group: "paths",
        title: path.title,
        meta: [topic, LEVEL_LABEL[path.level]].filter(Boolean).join(" · "),
        icon: "paths",
        sample: pathsSample,
        action: { kind: "navigate", href: pathHref(path, paths) },
        secondary: [topic, path.level, path.description],
      };
    }),
    resources: library.items.map((item) => ({
      id: `resource-${item.id}`,
      group: "resources",
      title: item.title,
      meta: [item.sourceName, item.lengthLabel].filter(Boolean).join(" · "),
      icon: "library",
      kind: item.kind,
      typeLabel: TYPE_LABEL[item.kind],
      sample: item.sample,
      action: { kind: "navigate", href: `${ROUTES.app.library}/${item.id}` },
      secondary: [item.topicName, item.sourceName, item.kind],
    })),
  };
}

export const seeAllHref = (query: string) =>
  `${ROUTES.app.library}?q=${encodeURIComponent(normaliseCommandQuery(query))}`;

function pageRow(page: (typeof COMMAND_PAGES)[number], group: CommandGroupId): CommandRow {
  return {
    id: `page-${page.id}`,
    group,
    title: page.title,
    meta: "",
    icon: page.icon,
    sample: false,
    action: page.action,
  };
}

/** The empty-query view: the jump list, then the recent searches (with a clear row). */
export function emptyGroups(recent: readonly string[]): CommandGroup[] {
  const jump = COMMAND_PAGES.filter((page) => page.jump).map((page) => pageRow(page, "jump"));
  const groups: CommandGroup[] = [{ id: "jump", label: GROUP_LABEL.jump, rows: jump }];
  if (recent.length > 0) {
    const rows: CommandRow[] = recent.map((q, i) => ({
      id: `recent-${i}`,
      group: "recent",
      title: q,
      meta: "",
      icon: "recent",
      sample: false,
      action: { kind: "search", query: q },
    }));
    rows.push({
      id: "recent-clear",
      group: "recent",
      title: "Clear recent searches",
      meta: "",
      icon: "clear",
      sample: false,
      action: { kind: "clear-recent" },
    });
    groups.push({ id: "recent", label: GROUP_LABEL.recent, rows });
  }
  return groups;
}

const PAGE_ENTRIES = COMMAND_PAGES.map((page) => ({
  row: pageRow(page, "pages"),
  title: page.title,
  secondary: [...page.keywords],
}));

/** Grouped matches for a typed query; empty groups are left out. */
export function searchGroups(index: CommandIndex, query: string): CommandGroup[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const groups: CommandGroup[] = [
    {
      id: "paths",
      label: GROUP_LABEL.paths,
      rows: rankItems(index.paths, terms, GROUP_LIMITS.paths),
    },
    {
      id: "resources",
      label: GROUP_LABEL.resources,
      rows: rankItems(index.resources, terms, GROUP_LIMITS.resources),
    },
    {
      id: "pages",
      label: GROUP_LABEL.pages,
      rows: rankItems(PAGE_ENTRIES, terms, GROUP_LIMITS.pages).map((entry) => entry.row),
    },
  ];
  return groups.filter((group) => group.rows.length > 0);
}

/** The "See all results" row that closes a typed-query list. */
export function seeAllRow(query: string): CommandRow {
  return {
    id: "see-all",
    group: "pages",
    title: `See all results for “${normaliseCommandQuery(query)}”`,
    meta: "",
    icon: "all",
    sample: false,
    action: { kind: "navigate", href: seeAllHref(query) },
  };
}

export const flattenGroups = (groups: readonly CommandGroup[]): CommandRow[] =>
  groups.flatMap((group) => group.rows);
