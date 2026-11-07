import type { Catalogue, Level, ResourceFormat, TopicSlug } from "../../../lib/catalogue/types";
import {
  TOPIC_CONTENT,
  type TopicContent,
  USE_SAMPLE_WHEN_EMPTY,
} from "../../../lib/pages/topic-content";
import { buildTopicViews, type PathCardView } from "../../landing/at-work-data";

export type ResourceCardView = {
  title: string;
  source: string;
  format: ResourceFormat;
  /** "15:04", "6 min read", "Free tool". */
  length: string;
  meta: string;
  /** Original source URL (lessons link out); absent on design sample data. */
  url?: string;
};

export type TopicPageView = {
  content: TopicContent;
  stats: { paths: number; lessons: number; hours: number; levels: Level[] };
  quote: string | null;
  sourcePath: string | null;
  paths: PathCardView[];
  resources: ResourceCardView[];
  /** True when the numbers and cards are the Figma design samples, not catalogue data. */
  sampled: boolean;
};

const MAX_RESOURCES = 6;

function lengthLabel(format: ResourceFormat, minutes: number): string {
  if (format === "tool") return "Free tool";
  if (format === "video") return `${minutes} min`;
  return `${minutes} min read`;
}

/**
 * Everything a topic page shows that is not marketing copy, from the catalogue: stats, paths and
 * resources. While the catalogue has no published path for the topic the design samples stand in
 * (USE_SAMPLE_WHEN_EMPTY); otherwise an empty topic renders its empty state.
 */
export function buildTopicPageView(catalogue: Catalogue, slug: TopicSlug): TopicPageView {
  const content = TOPIC_CONTENT[slug];
  const real = buildTopicViews(catalogue).find((topic) => topic.slug === slug);
  const sources = new Map(catalogue.sources.map((source) => [source.slug, source.name]));
  const realResources: ResourceCardView[] = catalogue.resources
    .filter((resource) => resource.topicSlug === slug && resource.status === "live")
    .slice(0, MAX_RESOURCES)
    .map((resource) => ({
      title: resource.title,
      source: sources.get(resource.sourceSlug) ?? resource.sourceSlug,
      format: resource.format,
      length: lengthLabel(resource.format, resource.lengthMinutes),
      meta: content.name,
      url: resource.url,
    }));

  if (real && real.paths > 0) {
    return {
      content,
      stats: { paths: real.paths, lessons: real.lessons, hours: real.hours, levels: real.levels },
      quote: real.quote,
      sourcePath: real.sourcePath,
      paths: real.cards,
      resources: realResources,
      sampled: false,
    };
  }

  if (USE_SAMPLE_WHEN_EMPTY) {
    const { sample } = content;
    return {
      content,
      stats: sample.stats,
      quote: sample.quote,
      sourcePath: sample.sourcePath,
      paths: sample.paths.map((path, index) => ({ ...path, slug: `sample-${index}` })),
      resources: realResources.length > 0 ? realResources : sample.resources,
      sampled: true,
    };
  }

  return {
    content,
    stats: { paths: 0, lessons: 0, hours: 0, levels: [] },
    quote: null,
    sourcePath: null,
    paths: [],
    resources: realResources,
    sampled: false,
  };
}
