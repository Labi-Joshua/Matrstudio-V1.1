import { CircleCheckIcon, HUE_TEXT } from "./topic-art";
import { BADGE } from "./topic-hero";
import type { TopicPageView } from "./topic-view";

/** Figma About (780:16741): intro on the left, "What you'll learn" card on the right. */
export function TopicAbout({ view }: { view: TopicPageView }) {
  const { about } = view.content;
  return (
    <section
      aria-labelledby="topic-about-heading"
      className="border-border-soft border-t px-5 lg:px-8"
    >
      <div className="mx-auto flex max-w-[1240px] flex-col gap-10 border-border-soft border-r border-l px-4 py-14 md:px-10 md:py-24 xl:flex-row xl:items-start xl:gap-16">
        <div className="flex flex-col items-start gap-5 xl:w-[520px] xl:shrink-0">
          <p
            className={`font-mono text-[12px] uppercase leading-[normal] tracking-[0.72px] ${HUE_TEXT}`}
          >
            About this topic
          </p>
          <h2
            id="topic-about-heading"
            className="font-medium text-[32px] text-text leading-[38px] tracking-[-0.96px] md:text-[44px] md:leading-[50px] md:tracking-[-0.66px]"
          >
            {about.heading}
          </h2>
          <p className="text-[16px] text-text leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]">
            {about.primary}
          </p>
          <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]">
            {about.secondary}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-6 rounded-3xl bg-bg-fill1 p-6 md:p-9 xl:flex-1">
          <h3 className="font-semibold text-[18px] text-text leading-7 tracking-[-0.18px]">
            What you’ll learn
          </h3>
          <ul className="flex flex-col gap-3">
            {about.learn.map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className={`shrink-0 ${HUE_TEXT}`}>
                  <CircleCheckIcon />
                </span>
                <span className="text-[16px] text-text leading-6 tracking-[-0.16px]">{item}</span>
              </li>
            ))}
          </ul>
          <hr className="h-px border-0 bg-border-soft" />
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
                Who it’s for
              </h3>
              <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">
                {about.who}
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              <h3 className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
                Tools you’ll use
              </h3>
              <ul className="flex flex-wrap items-start gap-2">
                {about.tools.map((tool) => (
                  <li key={tool} className={BADGE}>
                    <span className="px-0.5">{tool}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
