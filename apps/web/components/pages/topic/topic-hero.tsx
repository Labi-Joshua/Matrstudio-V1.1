import Link from "next/link";
import { ROUTES } from "../../../lib/routes";
import { HUE_TEXT, TopicPattern } from "./topic-art";
import type { TopicPageView } from "./topic-view";

const LEVEL_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export const BADGE =
  "rounded-md border border-border-soft-alpha px-1.5 py-1 font-medium text-[14px] text-text-secondary leading-5 tracking-[-0.14px]";

/** Stat badges: only what the catalogue backs up ("2 paths", "22 lessons", "About 16 hrs", levels, "Free"). */
function statBadges({ stats }: TopicPageView): string[] {
  const badges: string[] = [];
  if (stats.paths > 0) badges.push(`${stats.paths} ${plural(stats.paths, "path", "paths")}`);
  if (stats.lessons > 0)
    badges.push(`${stats.lessons} ${plural(stats.lessons, "lesson", "lessons")}`);
  if (stats.hours > 0) badges.push(`About ${Math.round(stats.hours)} hrs`);
  for (const level of stats.levels) badges.push(LEVEL_LABEL[level]);
  badges.push("Free");
  return badges;
}

/**
 * Figma "Topic · <name> · Desktop · Dark" Hero (780:16686 for UI/UX): eyebrow, headline, intro,
 * stat badges, two buttons and the tile strip. The strip's height is two tiles and the section
 * reserves it plus 96px below the buttons (256px at 1920).
 */
export function TopicHero({ view }: { view: TopicPageView }) {
  const { content } = view;
  return (
    <section
      aria-labelledby="topic-hero-heading"
      className="relative px-5 [--tile:clamp(36px,calc(100vw/24),80px)] lg:px-8"
    >
      <div className="mx-auto max-w-[1240px] border-border-soft border-r border-l">
        <div className="flex flex-col items-center gap-6 px-4 pt-16 pb-[calc(var(--tile)*2+56px)] text-center md:px-10 md:pt-[112px] md:pb-[calc(var(--tile)*2+96px)]">
          <p
            className={`font-mono text-[12px] uppercase leading-[normal] tracking-[0.72px] md:text-[13px] md:tracking-[0.78px] ${HUE_TEXT}`}
          >
            {content.eyebrow}
          </p>
          <h1
            id="topic-hero-heading"
            className="max-w-[1000px] text-balance font-medium text-[40px] text-text leading-[46px] tracking-[-1px] md:text-[56px] md:leading-[62px] md:tracking-[-1.4px] xl:text-[72px] xl:leading-[78px] xl:tracking-[-1.8px]"
          >
            {content.title}
          </h1>
          <p className="max-w-[680px] text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]">
            {content.intro}
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {statBadges(view).map((badge) => (
              <li key={badge} className={BADGE}>
                <span className="px-0.5">{badge}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={ROUTES.paths}
              className="btn-lift flex h-12 items-center justify-center rounded-lg bg-primary px-3.5 py-3 font-medium text-[16px] text-static-white leading-6 tracking-[-0.16px]"
            >
              <span className="px-0.5">Start the first path</span>
            </Link>
            <Link
              href={ROUTES.paths}
              className="btn-lift flex h-12 items-center justify-center rounded-lg border border-border bg-bg-elevation-1 px-3.5 py-3 font-medium text-[16px] text-text leading-6 tracking-[-0.16px] shadow-e1"
            >
              <span className="px-0.5">See all topics</span>
            </Link>
          </div>
        </div>
      </div>
      <TopicPattern />
    </section>
  );
}
