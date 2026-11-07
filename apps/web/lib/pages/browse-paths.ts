import { lessonsOf, pathHours } from "../catalogue/derive";
import type { Catalogue, Level, TopicSlug } from "../catalogue/types";

/** One path card on /paths. */
export type BrowsePath = {
  slug: string;
  title: string;
  description: string;
  topicSlug: TopicSlug;
  level: Level;
  lessons: number;
  hours: number;
};

/**
 * DESIGN SAMPLE DATA (Figma "Page · Paths", frames 773:37 / 780:11770). These eight cards are
 * what the design shows, used ONLY while the catalogue has no published paths so the page keeps
 * its layout. Replace with catalogue data: the page prefers real paths the moment
 * catalogue.paths contains any published path. Titles, copy, lessons and hours are not verified
 * content.
 */
export const SAMPLE_PATHS: BrowsePath[] = [
  {
    slug: "ui-ux-design-foundations",
    title: "UI/UX Design Foundations",
    description: "Go from layout basics to a tested prototype using free videos and articles.",
    topicSlug: "ui-ux",
    level: "beginner",
    lessons: 12,
    hours: 8,
  },
  {
    slug: "product-design-essentials",
    title: "Product Design Essentials",
    description: "Learn how product designers frame problems, map flows and ship features.",
    topicSlug: "product",
    level: "beginner",
    lessons: 10,
    hours: 7,
  },
  {
    slug: "brand-identity-basics",
    title: "Brand Identity Basics",
    description: "Build a simple brand: logo, colour, type and a one-page guideline.",
    topicSlug: "brand",
    level: "beginner",
    lessons: 9,
    hours: 6,
  },
  {
    slug: "social-media-design",
    title: "Social Media Design",
    description: "Design posts, carousels and stories that stay on brand and get noticed.",
    topicSlug: "social-media",
    level: "beginner",
    lessons: 8,
    hours: 5,
  },
  {
    slug: "seo-for-designers",
    title: "SEO for Designers",
    description: "Understand how search works and design pages people and search engines can find.",
    topicSlug: "seo",
    level: "beginner",
    lessons: 7,
    hours: 4,
  },
  {
    slug: "design-systems-101",
    title: "Design Systems 101",
    description: "Tokens, components and documentation, from a single button to a shared library.",
    topicSlug: "design-systems",
    level: "intermediate",
    lessons: 11,
    hours: 9,
  },
  {
    slug: "dev-handoff",
    title: "Dev Handoff",
    description: "Prepare files developers love: specs, redlines, tokens and annotations.",
    topicSlug: "dev-handoff",
    level: "intermediate",
    lessons: 8,
    hours: 5,
  },
  {
    slug: "advanced-prototyping",
    title: "Advanced Prototyping",
    description: "Smart animate, variables and conditional logic for realistic prototypes.",
    topicSlug: "ui-ux",
    level: "advanced",
    lessons: 10,
    hours: 8,
  },
];

/** Published catalogue paths as cards; the design sample while the catalogue has none. */
export function getBrowsePaths(catalogue: Catalogue): { paths: BrowsePath[]; isSample: boolean } {
  const paths = catalogue.paths
    .filter((path) => path.status === "published")
    .map((path) => ({
      slug: path.slug,
      title: path.title,
      description: path.description,
      topicSlug: path.topicSlug,
      level: path.level,
      lessons: lessonsOf(catalogue, path.slug).length,
      hours: pathHours(catalogue, path.slug),
    }));
  return paths.length > 0 ? { paths, isSample: false } : { paths: SAMPLE_PATHS, isSample: true };
}
