import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonPage } from "../../../../../../../../components/app-paths/lesson-page";
import {
  buildLessonView,
  lessonHref,
  lessonParams,
} from "../../../../../../../../lib/app/paths-lessons";
import { getCatalogue } from "../../../../../../../../lib/catalogue/data";
import type { TopicSlug } from "../../../../../../../../lib/catalogue/types";
import { TOPIC_CONTENT } from "../../../../../../../../lib/pages/topic-content";
import { pageMeta } from "../../../../../../../../lib/site";

// One page per lesson of every catalogue path, all prerendered; anything else is a 404.
export const dynamicParams = false;

type Params = Promise<{ topic: string; path: string; lesson: string }>;

const isTopic = (slug: string): slug is TopicSlug => slug in TOPIC_CONTENT;

export function generateStaticParams() {
  return lessonParams(getCatalogue());
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { topic, path, lesson } = await params;
  if (!isTopic(topic)) return { robots: { index: false, follow: false } };
  const view = buildLessonView(getCatalogue(), topic, path, lesson);
  if (!view) return { robots: { index: false, follow: false } };
  return {
    ...pageMeta({
      title: `${view.lesson.title} | ${view.detail.path.title} | Matr Studio`,
      description: `Lesson ${view.number} of ${view.total} in ${view.detail.path.title} on Matr Studio.`,
      path: lessonHref(topic, path, lesson),
    }),
    robots: { index: false, follow: false },
  };
}

/** Progress is read in the client component, so the page itself is the same for everyone. */
export default async function LessonRoute({ params }: { params: Params }) {
  const { topic, path, lesson } = await params;
  if (!isTopic(topic)) notFound();
  return <LessonPage topic={topic} pathSlug={path} lessonId={lesson} />;
}
