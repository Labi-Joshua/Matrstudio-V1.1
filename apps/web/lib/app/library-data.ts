import type { Catalogue, Level, Topic, TopicSlug } from "../catalogue/types";
import { type BrowseResource, filterOf, getLibraryData } from "../pages/browse-library";
import { buildOnboardingPaths } from "../pages/onboarding-content";
import { USE_SAMPLE_WHEN_EMPTY } from "../pages/topic-content";

/**
 * Data behind the in-app Library (/learn/library, /learn/library/[id]): the catalogue's live
 * resources and published paths as view models. Pure and empty-safe. While the catalogue has no
 * live resources the design sample cards stand in (only when USE_SAMPLE_WHEN_EMPTY is on) and every
 * item is flagged `sample`; sample items have no URL, so nothing can open them.
 */
export type LibraryKind = "video" | "article" | "tool";

export type LibraryItem = BrowseResource & {
  kind: LibraryKind;
  /** null when the topic name is not one of the catalogue topics. */
  topicSlug: TopicSlug | null;
  sample: boolean;
};

export type LibraryPath = {
  slug: string;
  topicSlug: TopicSlug;
  title: string;
  level: Level;
  lessons: number;
  sample: boolean;
};

export type LibrarySource = { slug: string; name: string };

export type LibraryModel = {
  items: LibraryItem[];
  /** Every catalogue topic, in catalogue order (the chip row). */
  topics: Topic[];
  /** Sources that have at least one item, by name. */
  sources: LibrarySource[];
  paths: LibraryPath[];
  /** Counter text for the total ("540+" for the design sample). */
  totalLabel: string;
  sample: boolean;
};

export function buildLibraryModel(
  catalogue: Catalogue,
  useSample: boolean = USE_SAMPLE_WHEN_EMPTY,
): LibraryModel {
  const data = getLibraryData(catalogue);
  const showItems = !data.isSample || useSample;
  const topicByName = new Map(catalogue.topics.map((topic) => [topic.name, topic.slug]));
  const items = showItems
    ? data.resources.map<LibraryItem>((resource) => ({
        ...resource,
        kind: filterOf(resource.format),
        topicSlug: topicByName.get(resource.topicName) ?? null,
        sample: data.isSample,
      }))
    : [];
  const sources = new Map<string, string>();
  for (const item of items) sources.set(item.sourceSlug, item.sourceName);
  return {
    items,
    topics: catalogue.topics,
    sources: [...sources]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    paths: buildOnboardingPaths(catalogue, useSample).map((path) => ({
      slug: path.slug,
      topicSlug: path.topicSlug,
      title: path.title,
      level: path.level,
      lessons: path.lessons,
      sample: path.sample,
    })),
    totalLabel: showItems ? data.totalLabel : "0",
    sample: showItems && data.isSample,
  };
}

/** Published catalogue paths that use a resource as a lesson (empty for sample content). */
export function pathsUsing(catalogue: Catalogue, resourceId: string) {
  return catalogue.pathLessons
    .filter((lesson) => lesson.resourceId === resourceId)
    .flatMap((lesson) => {
      const path = catalogue.paths.find((p) => p.slug === lesson.pathSlug);
      if (path?.status !== "published") return [];
      const total = catalogue.pathLessons.filter((l) => l.pathSlug === path.slug).length;
      return [
        {
          slug: path.slug,
          topicSlug: path.topicSlug,
          title: path.title,
          lesson: lesson.position + 1,
          lessons: total,
        },
      ];
    });
}

/** "More like this": same topic first, then the rest, never the item itself. */
export function relatedItems(item: LibraryItem, items: readonly LibraryItem[], limit = 2) {
  const others = items.filter((other) => other.id !== item.id);
  const same = others.filter((other) => other.topicName === item.topicName);
  const rest = others.filter((other) => other.topicName !== item.topicName);
  return [...same, ...rest].slice(0, limit);
}

export const KIND_UPPER: Record<LibraryKind, string> = {
  video: "VIDEO",
  article: "ARTICLE",
  tool: "TOOL",
};

/** Eyebrow above the title, e.g. "VIDEO · UI/UX · BEGINNER". */
export function eyebrow(item: LibraryItem, levelText: (level: Level) => string): string {
  return [KIND_UPPER[item.kind], item.topicName, item.level ? levelText(item.level) : ""]
    .filter(Boolean)
    .join(" · ")
    .toUpperCase();
}

/**
 * The only URLs the app opens in a new tab: https, from the catalogue. Anything else (empty for
 * sample content, http:, javascript:) is treated as "no link" (docs/SECURITY-AUTH.md section 8).
 */
export function safeResourceUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}
