import type { Catalogue, Level, ResourceFormat } from "../catalogue/types";

/** One resource card on /library and /saved. */
export type BrowseResource = {
  id: string;
  title: string;
  /** Original source URL; empty for design sample data (the card then has no working link). */
  url: string;
  sourceSlug: string;
  sourceName: string;
  format: ResourceFormat;
  /** Badge on the thumbnail: "15:04", "8 min read", "Free tool". */
  lengthLabel: string;
  topicName: string;
  /** The catalogue Resource type has no level yet; the design shows "UI/UX · Beginner". */
  level: Level | null;
};

export const LEVEL_TEXT: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** Library filter chips (Figma Types: All, Video, Article, Tool). "docs" resources count as articles. */
export type TypeFilter = "all" | "video" | "article" | "tool";
export const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "article", label: "Article" },
  { value: "tool", label: "Tool" },
];

export const filterOf = (format: ResourceFormat): Exclude<TypeFilter, "all"> =>
  format === "video" ? "video" : format === "tool" ? "tool" : "article";

export const TYPE_LABEL: Record<Exclude<TypeFilter, "all">, string> = {
  video: "Video",
  article: "Article",
  tool: "Tool",
};

function lengthLabel(format: ResourceFormat, minutes: number): string {
  if (format === "tool") return "Free tool";
  if (format === "video") return `${minutes} min`;
  return `${minutes} min read`;
}

/**
 * DESIGN SAMPLE DATA (Figma "Page · Library", frames 774:930 / 780:12990): the twelve cards the
 * design shows, used ONLY while the catalogue has no live resources. Titles, sources, lengths and
 * levels are not verified content and have no URLs. Replace with catalogue.resources.
 */
const s = (
  n: number,
  title: string,
  sourceSlug: string,
  sourceName: string,
  format: ResourceFormat,
  length: string,
  topicName: string,
): BrowseResource => ({
  id: `sample-${n}`,
  title,
  url: "",
  sourceSlug,
  sourceName,
  format,
  lengthLabel: length,
  topicName,
  level: "beginner",
});

export const SAMPLE_RESOURCES: BrowseResource[] = [
  s(1, "Mapping user flows", "youtube", "YouTube", "video", "15:04", "UI/UX"),
  s(
    2,
    "Turning research into insights",
    "nielsen-norman-group",
    "NN/g",
    "article",
    "8 min read",
    "Product",
  ),
  s(3, "Auto layout, explained", "figma", "Figma", "video", "12:20", "UI/UX"),
  s(4, "FigJam templates for workshops", "figma", "Figma", "tool", "Free tool", "Product"),
  s(5, "Writing UX copy that helps", "medium", "Medium", "article", "6 min read", "UI/UX"),
  s(6, "Colour contrast checker", "webaim", "WebAIM", "tool", "Free tool", "UI/UX"),
  s(7, "Design tokens in practice", "youtube", "YouTube", "video", "18:02", "Design systems"),
  s(8, "Journey mapping board", "miro", "Miro", "tool", "Free tool", "Product"),
  s(
    9,
    "How to run a usability test",
    "nielsen-norman-group",
    "NN/g",
    "article",
    "10 min read",
    "Product",
  ),
  s(10, "Colour theory for designers", "youtube", "YouTube", "video", "22:15", "Brand"),
  s(11, "Typography basics for UI", "youtube", "YouTube", "video", "16:40", "UI/UX"),
  s(12, "SEO basics for designers", "moz", "Moz", "article", "9 min read", "SEO"),
];

/** Sample total shown in the counter ("12 OF 540+ RESOURCES"); real total comes from the catalogue. */
export const SAMPLE_TOTAL_LABEL = "540+";

export type LibraryData = {
  resources: BrowseResource[];
  /** Counter text for the total, e.g. "540+" for the sample, the live count otherwise. */
  totalLabel: string;
  isSample: boolean;
};

/** Live catalogue resources as cards; the design sample while the catalogue has none. */
export function getLibraryData(catalogue: Catalogue): LibraryData {
  const sources = new Map(catalogue.sources.map((source) => [source.slug, source.name]));
  const topics = new Map(catalogue.topics.map((topic) => [topic.slug, topic.name]));
  const resources = catalogue.resources
    .filter((resource) => resource.status === "live")
    .map<BrowseResource>((resource) => ({
      id: resource.id,
      title: resource.title,
      url: resource.url,
      sourceSlug: resource.sourceSlug,
      sourceName: sources.get(resource.sourceSlug) ?? resource.sourceSlug,
      format: resource.format,
      lengthLabel: lengthLabel(resource.format, resource.lengthMinutes),
      topicName: topics.get(resource.topicSlug) ?? "",
      level: null,
    }));
  return resources.length > 0
    ? { resources, totalLabel: String(resources.length), isSample: false }
    : { resources: SAMPLE_RESOURCES, totalLabel: SAMPLE_TOTAL_LABEL, isSample: true };
}
