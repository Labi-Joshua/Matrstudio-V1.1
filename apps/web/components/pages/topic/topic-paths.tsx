import Link from "next/link";
import { ROUTES } from "../../../lib/routes";
import { BookIcon, ClockIcon, PathCover, StarOutline, TOPIC_LOOK } from "../../landing/at-work-art";
import type { PathCardView } from "../../landing/at-work-data";
import type { TopicPageView } from "./topic-view";

const LEVEL_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const LEVEL_CLASS = {
  beginner: "bg-success-focus text-success-text",
  intermediate: "bg-warning-focus text-warning-text",
  advanced: "bg-error-focus text-error-text",
};
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

function PathCard({ card, view }: { card: PathCardView; view: TopicPageView }) {
  return (
    <article className="card-lift relative flex flex-col overflow-clip rounded-2xl border border-border-soft bg-bg-base md:flex-1 xl:w-[340px] xl:flex-none">
      <PathCover topic={view.content.slug} hue={TOPIC_LOOK[view.content.slug].cover} />
      <span
        aria-hidden="true"
        className="absolute top-[11px] right-[11px] flex size-9 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text"
      >
        <StarOutline />
      </span>
      <div className="flex flex-col items-start gap-2 px-4 pt-4 pb-[18px]">
        <span className={`rounded-md px-1.5 py-[3px] ${LEVEL_CLASS[card.level]}`}>
          <span className="block px-0.5 font-medium text-[13px] leading-[18px] tracking-[-0.13px]">
            {LEVEL_LABEL[card.level]}
          </span>
        </span>
        <h3 className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
          {card.title}
        </h3>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          {card.description}
        </p>
        <p className="flex items-center gap-3.5 pt-1 font-medium text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          <span className="flex items-center gap-1">
            <BookIcon />
            {card.lessons} {plural(card.lessons, "lesson", "lessons")}
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon />
            {card.hours} hrs
          </span>
        </p>
      </div>
    </article>
  );
}

/** Figma Paths (780:16780): heading, then the colour panel (quote) next to the topic's path cards. */
export function TopicPaths({ view }: { view: TopicPageView }) {
  const { content } = view;
  return (
    <section
      aria-labelledby="topic-paths-heading"
      className="border-border-soft border-t px-5 lg:px-8"
    >
      <div className="mx-auto flex max-w-[1240px] flex-col gap-10 border-border-soft border-r border-l px-4 py-14 md:px-10 md:py-24">
        <h2
          id="topic-paths-heading"
          className="font-medium text-[32px] text-text leading-[38px] tracking-[-0.96px] md:text-[44px] md:leading-[50px] md:tracking-[-0.88px]"
        >
          {content.pathsHeading}
        </h2>
        {view.paths.length > 0 ? (
          <div className="flex flex-col gap-4 xl:flex-row">
            <div className="flex flex-col justify-between gap-7 bg-(--h) p-6 font-medium text-static-white md:p-10 xl:flex-1">
              <p className="text-[24px] leading-[30px] tracking-[-0.24px] md:text-[30px] md:leading-[38px] md:tracking-[-0.3px]">
                “{view.quote}”
              </p>
              {view.sourcePath ? (
                <p className="text-[14px] leading-5 tracking-[-0.14px]">
                  From the {view.sourcePath} path
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-4 md:flex-row xl:flex-none">
              {view.paths.map((card) => (
                <PathCard key={card.slug} card={card} view={view} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4 rounded-3xl bg-bg-fill1 p-6 md:p-10">
            <p className="text-[18px] text-text-secondary leading-7 tracking-[-0.18px]">
              Paths for this topic are on their way.
            </p>
            <Link
              href={ROUTES.paths}
              className="link-slide font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]"
            >
              Browse all paths
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
