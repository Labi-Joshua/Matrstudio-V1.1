import { lessonsOf, pathHours, topicStats } from "../../lib/catalogue/derive";
import type { Catalogue, Level, TopicSlug } from "../../lib/catalogue/types";

/**
 * View model for the "At work" accordion, built from the catalogue and nothing else. Every field
 * is empty-safe: a topic with no published paths yields a zero count, no quote, no source path and
 * no cards, and the UI renders the Figma layout around that (see AtWorkAccordion).
 *
 * What each topic's open state needs from the catalogue (Figma frames 760:39604 and siblings):
 *  - quote:        the topic's first published path `description` (shown in the colour panel)
 *  - sourcePath:   that path's `title` ("From the <title> path")
 *  - stats:        topicStats() chips: paths, lessons, hours, levels
 *  - cards:        one Path Card per published path: title, description, level, lesson count, hours
 */
export type PathCardView = {
  slug: string;
  title: string;
  description: string;
  level: Level;
  lessons: number;
  hours: number;
};

export type TopicView = {
  slug: TopicSlug;
  name: string;
  paths: number;
  lessons: number;
  hours: number;
  levels: Level[];
  quote: string | null;
  sourcePath: string | null;
  cards: PathCardView[];
};

export function buildTopicViews(catalogue: Catalogue): TopicView[] {
  return catalogue.topics.map((topic) => {
    const stats = topicStats(catalogue, topic.slug);
    const cards: PathCardView[] = catalogue.paths
      .filter((path) => path.status === "published" && path.topicSlug === topic.slug)
      .map((path) => ({
        slug: path.slug,
        title: path.title,
        description: path.description,
        level: path.level,
        lessons: lessonsOf(catalogue, path.slug).length,
        hours: pathHours(catalogue, path.slug),
      }));
    return {
      slug: topic.slug,
      name: topic.name,
      ...stats,
      quote: cards[0]?.description ?? null,
      sourcePath: cards[0]?.title ?? null,
      cards,
    };
  });
}
