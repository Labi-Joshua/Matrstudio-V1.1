import Link from "next/link";
import type { Catalogue } from "../../lib/catalogue/types";
import { ROUTES } from "../../lib/routes";
import { AtWorkAccordion } from "./at-work-accordion";
import { ChevronDown } from "./at-work-art";
import { buildTopicViews } from "./at-work-data";

/**
 * Figma "Landing V3": At work 740:37946 (desktop), 741:41083 (mobile). Heading with a link, then
 * the seven topic accordion items (data-driven from the catalogue; see at-work-data.ts for what
 * each open topic needs). The rail borders match the other sections.
 */
export function AtWork({ catalogue }: { catalogue: Catalogue }) {
  const topics = buildTopicViews(catalogue);
  return (
    <section
      id="at-work"
      aria-labelledby="at-work-heading"
      className="border-border-soft border-b px-5 lg:px-8"
    >
      <div className="mx-auto max-w-[1240px] border-border-soft border-r border-l">
        <div className="flex flex-col gap-4 border-border-soft border-b px-4 pt-14 pb-8 md:flex-row md:items-end md:px-10 md:pt-24 md:pb-14">
          <h2
            id="at-work-heading"
            className="font-medium text-[32px] text-text leading-[38px] tracking-[-0.96px] md:flex-1 md:text-[44px] md:leading-[50px] md:tracking-[-0.44px]"
          >
            See Matr Studio at work.
          </h2>
          <Link
            href={ROUTES.paths}
            className="link-slide flex shrink-0 items-center gap-2 font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]"
          >
            Browse all paths
            <ChevronDown className="size-4 -rotate-90" />
          </Link>
        </div>
        <AtWorkAccordion topics={topics} />
      </div>
    </section>
  );
}
