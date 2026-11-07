import { notFound } from "next/navigation";
import { TopicPage } from "../../../../components/pages/topic/topic-page";
import { getCatalogue } from "../../../../lib/catalogue/data";
import type { TopicSlug } from "../../../../lib/catalogue/types";
import { TOPIC_CONTENT } from "../../../../lib/pages/topic-content";
import { ROUTES } from "../../../../lib/routes";
import { pageMeta } from "../../../../lib/site";

// One page per catalogue topic, all prerendered; any other slug is a 404.
export const dynamicParams = false;

type Params = Promise<{ topic: string }>;

const isTopic = (slug: string): slug is TopicSlug => slug in TOPIC_CONTENT;

export function generateStaticParams() {
  return getCatalogue()
    .topics.filter((topic) => topic.slug in TOPIC_CONTENT)
    .map((topic) => ({ topic: topic.slug }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { topic } = await params;
  if (!isTopic(topic)) return {};
  const { meta } = TOPIC_CONTENT[topic];
  return pageMeta({ title: meta.title, description: meta.description, path: ROUTES.topic(topic) });
}

export default async function TopicRoute({ params }: { params: Params }) {
  const { topic } = await params;
  if (!isTopic(topic)) notFound();
  return <TopicPage catalogue={getCatalogue()} slug={topic} />;
}
