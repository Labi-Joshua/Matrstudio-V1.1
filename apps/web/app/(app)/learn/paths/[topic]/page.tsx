import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PathDetail } from "../../../../../components/app-paths/path-detail";
import { PathDetailSkeleton } from "../../../../../components/app-paths/skeletons";
import { getCatalogue } from "../../../../../lib/catalogue/data";
import type { TopicSlug } from "../../../../../lib/catalogue/types";
import { TOPIC_CONTENT } from "../../../../../lib/pages/topic-content";
import { ROUTES } from "../../../../../lib/routes";
import { pageMeta } from "../../../../../lib/site";

// One page per catalogue topic, all prerendered; any other slug is a 404.
export const dynamicParams = false;

type Params = Promise<{ topic: string }>;

const isTopic = (slug: string): slug is TopicSlug => slug in TOPIC_CONTENT;

export function generateStaticParams() {
  return getCatalogue()
    .topics.filter((topic) => topic.slug in TOPIC_CONTENT)
    .map((topic) => ({ topic: topic.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { topic } = await params;
  if (!isTopic(topic)) return { robots: { index: false, follow: false } };
  return {
    ...pageMeta({
      title: `${TOPIC_CONTENT[topic].name} path | Matr Studio`,
      description: `A learning path for ${TOPIC_CONTENT[topic].name} on Matr Studio.`,
      path: ROUTES.app.pathTopic(topic),
    }),
    robots: { index: false, follow: false },
  };
}

/** The ?path= choice among a topic's paths is read in the client component, inside Suspense. */
export default async function PathTopicPage({ params }: { params: Params }) {
  const { topic } = await params;
  if (!isTopic(topic)) notFound();
  return (
    <Suspense fallback={<PathDetailSkeleton />}>
      <PathDetail topic={topic} />
    </Suspense>
  );
}
