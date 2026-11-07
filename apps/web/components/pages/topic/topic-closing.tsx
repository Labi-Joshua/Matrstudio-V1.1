import Link from "next/link";
import { TOPIC_CONTENT } from "../../../lib/pages/topic-content";
import { ROUTES } from "../../../lib/routes";
import { BADGE } from "./topic-hero";
import type { TopicPageView } from "./topic-view";

/** Figma Other topics (780:16799): a chip per other topic, linking to its page. */
export function TopicOthers({ view }: { view: TopicPageView }) {
  const others = Object.values(TOPIC_CONTENT).filter((topic) => topic.slug !== view.content.slug);
  return (
    <section
      aria-labelledby="topic-others-heading"
      className="border-border-soft border-t px-5 lg:px-8"
    >
      <div className="mx-auto flex max-w-[1240px] flex-col gap-10 border-border-soft border-r border-l px-4 py-14 md:px-10 md:py-24">
        <h2
          id="topic-others-heading"
          className="font-medium text-[28px] text-text leading-[34px] tracking-[-0.56px] md:text-[32px] md:leading-[38px] md:tracking-[-0.64px]"
        >
          Explore other topics
        </h2>
        <ul className="flex flex-wrap items-start gap-2">
          {others.map((topic) => (
            <li key={topic.slug}>
              <Link
                href={ROUTES.topic(topic.slug)}
                className={`${BADGE} block transition-colors hover:border-border hover:text-text`}
              >
                <span className="px-0.5">{topic.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Figma CTA (780:16809). No sign-up page exists yet, so both buttons point at the paths index
 * until one does.
 */
export function TopicCta({ view }: { view: TopicPageView }) {
  const { cta } = view.content;
  return (
    <section
      aria-labelledby="topic-cta-heading"
      className="border-border-soft border-t px-5 lg:px-8"
    >
      <div className="mx-auto max-w-[1240px] border-border-soft border-r border-l px-4 py-14 md:px-10 md:py-24">
        <div className="flex flex-col items-center gap-6 rounded-[28px] bg-bg-fill1 p-8 text-center md:p-16">
          <h2
            id="topic-cta-heading"
            className="max-w-[1030px] text-balance font-medium text-[32px] text-text leading-[38px] tracking-[-0.96px] md:text-[44px] md:leading-[50px] md:tracking-[-0.88px]"
          >
            {cta.heading}
          </h2>
          <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]">
            {cta.body}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={ROUTES.paths}
              className="btn-lift flex h-12 items-center justify-center rounded-lg bg-primary px-3.5 py-3 font-medium text-[16px] text-static-white leading-6 tracking-[-0.16px]"
            >
              <span className="px-0.5">Create a free account</span>
            </Link>
            <Link
              href={ROUTES.paths}
              className="btn-lift flex h-12 items-center justify-center rounded-lg border border-border bg-bg-elevation-1 px-3.5 py-3 font-medium text-[16px] text-text leading-6 tracking-[-0.16px] shadow-e1"
            >
              <span className="px-0.5">Browse all paths</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
