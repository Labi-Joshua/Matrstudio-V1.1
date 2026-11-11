import type { Catalogue, ResourceFormat, TopicSlug } from "../catalogue/types";
import type { BrowsePath } from "../pages/browse-paths";
import { SAMPLE_PATHS as ONBOARDING_SAMPLES } from "../pages/onboarding-content";
import { USE_SAMPLE_WHEN_EMPTY } from "../pages/topic-content";
import { getCatalogueData, plural } from "./paths-catalogue";

/**
 * The in-app path detail (Figma "5. Path detail"): header facts, what you'll learn, the lesson
 * list, where the lessons come from and who the path is for.
 *
 * Real data comes from the catalogue (lessons are resources with their original source URL).
 * The catalogue has no "outcomes" or "who it's for" fields yet, so those blocks only appear when
 * the design sample provides them. Sample detail exists for exactly what the frames show: the
 * full Product Design Essentials page, and the first three lessons of UI/UX Design Foundations
 * (from the onboarding frames). Every other path gets its header only, with an honest note where
 * the lesson list would be. Nothing is invented beyond the frames.
 */

export type LessonKind = "video" | "article" | "tool";

export type DetailLesson = {
  /** Stable id inside the path (the API stores it): the resource id, or a slug of the sample title. */
  id: string;
  title: string;
  kind: LessonKind;
  minutes: number | null;
  /** "YouTube"; null when the frame does not show it. */
  sourceName: string | null;
  sourceSlug: string | null;
  /** Original source URL (lessons link out to the free source). Null on design samples. */
  url: string | null;
};

export type DetailSource = { name: string; kind: LessonKind; count: number };

export type PathDetailView = {
  path: BrowsePath;
  topicName: string;
  description: string;
  lessons: DetailLesson[];
  /** True when `lessons` is the whole path (its length equals the path's lesson count). */
  lessonsComplete: boolean;
  outcomes: string[];
  audience: string[];
  sources: DetailSource[];
  /** Other paths of the same topic, for the "Also in this topic" links. */
  siblings: BrowsePath[];
  /** The topic's paths in order (path hrefs need it to know which one is the default). */
  topicPaths: BrowsePath[];
  /** First lesson's source URL when real data has one, else null (Start path is then disabled). */
  startUrl: string | null;
  sample: boolean;
};

type SampleDetail = {
  description: string;
  outcomes: string[];
  audience: string[];
  lessons: DetailLesson[];
};

/** "Framing the problem" -> "framing-the-problem" (fits the id pattern the API checks). */
const slugOf = (text: string | null) =>
  text
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || null;
const sampleLessonId = (title: string) => slugOf(title) ?? "lesson";

const lesson = (
  title: string,
  kind: LessonKind,
  minutes: number,
  sourceName: string,
): DetailLesson => ({
  id: sampleLessonId(title),
  title,
  kind,
  minutes,
  sourceName,
  sourceSlug: slugOf(sourceName),
  url: null,
});

/** Figma frame "Path detail (new account)": the Product Design Essentials page, as shown. */
const SAMPLE_DETAILS: Record<string, SampleDetail> = {
  "product-design-essentials": {
    description:
      "Learn how product designers frame problems, talk to users, map flows and ship features. Ten short lessons built from the best free videos and articles.",
    outcomes: [
      "Frame a product problem before jumping to screens",
      "Run short user interviews and pull out insights",
      "Map user flows and sketch solutions quickly",
      "Prototype, test with five users and ship with confidence",
    ],
    audience: [
      "New to product design, or moving over from graphic or UI design",
      "Comfortable with Figma basics",
      "About an hour a week is enough",
    ],
    lessons: [
      lesson("What product designers actually do", "video", 12, "YouTube"),
      lesson("Framing the problem", "article", 10, "Medium"),
      lesson("Talking to users", "video", 18, "YouTube"),
      lesson("Turning research into insights", "article", 8, "Nielsen Norman Group"),
      lesson("Mapping user flows", "video", 15, "YouTube"),
      lesson("Sketching ideas fast", "video", 11, "YouTube"),
      lesson("Wireframes that answer questions", "article", 9, "Medium"),
      lesson("From wireframe to prototype", "video", 22, "YouTube"),
      lesson("Testing with five users", "article", 7, "Nielsen Norman Group"),
      lesson("Shipping and measuring", "video", 16, "YouTube"),
    ],
  },
};

/** "YouTube · 12 min" or "Article · 8 min" (the onboarding frames) as a lesson. */
function fromOnboardingMeta(title: string, meta: string): DetailLesson {
  const [origin = "", length = ""] = meta.split(" · ");
  const minutes = Number.parseInt(length, 10);
  const kind: LessonKind = origin === "Article" ? "article" : origin === "Tool" ? "tool" : "video";
  const named = origin !== "Article" && origin !== "Docs" && origin !== "Tool";
  return {
    id: sampleLessonId(title),
    title,
    kind,
    minutes: Number.isFinite(minutes) ? minutes : null,
    sourceName: named ? origin : null,
    sourceSlug: named ? slugOf(origin) : null,
    url: null,
  };
}

function sampleLessons(slug: string): DetailLesson[] {
  const full = SAMPLE_DETAILS[slug]?.lessons;
  if (full) return full;
  const partial = ONBOARDING_SAMPLES.find((p) => p.slug === slug)?.firstLessons ?? [];
  return partial.map((l) => fromOnboardingMeta(l.title, l.meta));
}

const kindOf = (format: ResourceFormat): LessonKind =>
  format === "video" ? "video" : format === "tool" ? "tool" : "article";

/** "Video · 12 min · YouTube", "Article · 10 min read · Medium", "Tool · Free tool". */
export function lessonMeta(l: DetailLesson): string {
  const kind = l.kind === "video" ? "Video" : l.kind === "article" ? "Article" : "Tool";
  const length =
    l.kind === "tool"
      ? "Free tool"
      : l.minutes === null
        ? null
        : l.kind === "video"
          ? `${l.minutes} min`
          : `${l.minutes} min read`;
  return [kind, length, l.sourceName].filter(Boolean).join(" · ");
}

/** Sources behind the lessons, in order of first appearance: "YouTube · 6 videos". */
export function summariseSources(lessons: readonly DetailLesson[]): DetailSource[] {
  const found = new Map<string, DetailSource>();
  for (const l of lessons) {
    if (!l.sourceName) continue;
    const key = `${l.sourceName}|${l.kind}`;
    const entry = found.get(key);
    if (entry) entry.count += 1;
    else found.set(key, { name: l.sourceName, kind: l.kind, count: 1 });
  }
  return [...found.values()];
}

export function sourceCountLabel(source: DetailSource): string {
  const noun =
    source.kind === "video"
      ? plural(source.count, "video", "videos")
      : source.kind === "tool"
        ? plural(source.count, "tool", "tools")
        : plural(source.count, "article", "articles");
  return `${source.count} ${noun}`;
}

/** "about 7 hrs" for the lesson header; null when the path has no known length. */
export const aboutHours = (hours: number) => (hours > 0 ? `about ${hours} hrs` : null);

/** The paths of one topic, in catalogue order. */
export const pathsOfTopic = (paths: readonly BrowsePath[], topic: TopicSlug) =>
  paths.filter((path) => path.topicSlug === topic);

/**
 * The path a topic URL shows: the one named by ?path= when it belongs to the topic, else the
 * topic's first path. A ?path= that is not in the topic yields null ("This path isn't
 * available"), and so does a topic with no paths.
 */
export function selectPath(
  paths: readonly BrowsePath[],
  topic: TopicSlug,
  requested: string | null,
): BrowsePath | null {
  const inTopic = pathsOfTopic(paths, topic);
  if (requested) return inTopic.find((path) => path.slug === requested) ?? null;
  return inTopic[0] ?? null;
}

export function buildPathDetail(
  catalogue: Catalogue,
  topic: TopicSlug,
  requested: string | null,
  useSample: boolean = USE_SAMPLE_WHEN_EMPTY,
): PathDetailView | null {
  const data = getCatalogueData(catalogue, useSample);
  const path = selectPath(data.paths, topic, requested);
  if (!path) return null;
  const topicName = catalogue.topics.find((t) => t.slug === topic)?.name ?? topic;
  const topicPaths = pathsOfTopic(data.paths, topic);
  const siblings = topicPaths.filter((p) => p.slug !== path.slug);

  if (data.sample) {
    const detail = SAMPLE_DETAILS[path.slug];
    const lessons = sampleLessons(path.slug);
    return {
      path,
      topicName,
      description: detail?.description ?? path.description,
      lessons,
      lessonsComplete: lessons.length > 0 && lessons.length === path.lessons,
      outcomes: detail?.outcomes ?? [],
      audience: detail?.audience ?? [],
      sources: lessons.length === path.lessons ? summariseSources(lessons) : [],
      siblings,
      topicPaths,
      startUrl: null,
      sample: true,
    };
  }

  const resources = new Map(catalogue.resources.map((r) => [r.id, r]));
  const sourceNames = new Map(catalogue.sources.map((s) => [s.slug, s.name]));
  const lessons = catalogue.pathLessons
    .filter((l) => l.pathSlug === path.slug)
    .sort((a, b) => a.position - b.position)
    .flatMap((l, index): DetailLesson[] => {
      const resource = resources.get(l.resourceId);
      if (resource?.status !== "live") return [];
      return [
        {
          id: /^[a-z0-9][a-z0-9-]{0,63}$/.test(resource.id) ? resource.id : `lesson-${index + 1}`,
          title: resource.title,
          kind: kindOf(resource.format),
          minutes: resource.lengthMinutes,
          sourceName: sourceNames.get(resource.sourceSlug) ?? resource.sourceSlug,
          sourceSlug: resource.sourceSlug,
          url: resource.url || null,
        },
      ];
    });
  return {
    path,
    topicName,
    description: path.description,
    lessons,
    lessonsComplete: lessons.length > 0,
    outcomes: [],
    audience: [],
    sources: summariseSources(lessons),
    siblings,
    topicPaths,
    startUrl: lessons[0]?.url ?? null,
    sample: false,
  };
}
