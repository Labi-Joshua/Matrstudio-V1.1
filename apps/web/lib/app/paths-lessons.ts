import type { Catalogue, TopicSlug } from "../catalogue/types";
import { USE_SAMPLE_WHEN_EMPTY } from "../pages/topic-content";
import { ROUTES } from "../routes";
import type { LibraryItem } from "./library-data";
import { safeResourceUrl } from "./library-data";
import { getCatalogueData } from "./paths-catalogue";
import { buildPathDetail, type DetailLesson, type PathDetailView } from "./paths-detail";

/**
 * The lesson page of a path (Figma "Take a lesson"): which lesson it is, where it sits in the path
 * and the Library-shaped item the shared video block and article source card draw. Lessons open at
 * /learn/paths/{topic}/{path}/lessons/{lesson}; every one is prerendered (generateStaticParams),
 * like the topic pages. Pure and empty-safe.
 */

export const lessonHref = (topic: TopicSlug, pathSlug: string, lessonId: string) =>
  `${ROUTES.app.pathTopic(topic)}/${pathSlug}/lessons/${lessonId}`;

export type LessonView = {
  detail: PathDetailView;
  lesson: DetailLesson;
  /** 1-based. */
  number: number;
  /** The path's lesson count (it can exceed the lessons the catalogue lists so far). */
  total: number;
  item: LibraryItem;
  /** A real lesson without a usable https link: the source is unavailable (not sample content). */
  unavailable: boolean;
};

/** A lesson as the Library item that VideoBlock, SourceCard and ReadingWindow take. */
export function lessonItem(
  lesson: DetailLesson,
  detail: Pick<PathDetailView, "topicName" | "path" | "sample">,
): LibraryItem {
  const minutes = lesson.minutes;
  const lengthLabel =
    lesson.kind === "tool"
      ? "Free tool"
      : minutes === null
        ? ""
        : lesson.kind === "video"
          ? `${minutes} min`
          : `${minutes} min read`;
  return {
    id: lesson.id,
    title: lesson.title,
    url: lesson.url ?? "",
    sourceSlug: lesson.sourceSlug ?? "",
    sourceName: lesson.sourceName ?? "Original source",
    format: lesson.kind === "video" ? "video" : lesson.kind === "tool" ? "tool" : "article",
    lengthLabel,
    topicName: detail.topicName,
    level: detail.path.level,
    kind: lesson.kind,
    topicSlug: detail.path.topicSlug,
    sample: detail.sample,
  };
}

/** The lesson `lessonId` of `pathSlug` in `topic`; null for anything the catalogue does not have. */
export function buildLessonView(
  catalogue: Catalogue,
  topic: TopicSlug,
  pathSlug: string,
  lessonId: string,
  useSample: boolean = USE_SAMPLE_WHEN_EMPTY,
): LessonView | null {
  const detail = buildPathDetail(catalogue, topic, pathSlug, useSample);
  if (!detail) return null;
  const index = detail.lessons.findIndex((l) => l.id === lessonId);
  const lesson = detail.lessons[index];
  if (!lesson) return null;
  return {
    detail,
    lesson,
    number: index + 1,
    total: detail.path.lessons,
    item: lessonItem(lesson, detail),
    unavailable: !detail.sample && safeResourceUrl(lesson.url ?? "") === null,
  };
}

/** Every (topic, path, lesson) the static export builds a page for. */
export function lessonParams(
  catalogue: Catalogue,
  useSample: boolean = USE_SAMPLE_WHEN_EMPTY,
): { topic: TopicSlug; path: string; lesson: string }[] {
  return getCatalogueData(catalogue, useSample).paths.flatMap((path) => {
    const detail = buildPathDetail(catalogue, path.topicSlug, path.slug, useSample);
    return (detail?.lessons ?? []).map((l) => ({
      topic: path.topicSlug,
      path: path.slug,
      lesson: l.id,
    }));
  });
}

/** "Lesson 5 of 10" for the eyebrow, the bar between Previous and Next, and the phone card. */
export const lessonOf = (number: number, total: number) => `Lesson ${number} of ${total}`;
