// "Page · Paths" (Figma 773:36). One <h1>; the topic pages live under paths/[topic].

import Link from "next/link";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  PageHero,
} from "../../../components/pages/browse/page-hero";
import { PathsBrowser } from "../../../components/pages/browse/paths-browser";
import { PathsCta } from "../../../components/pages/browse/paths-cta";
import { getCatalogue } from "../../../lib/catalogue/data";
import { getBrowsePaths } from "../../../lib/pages/browse-paths";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata = pageMeta({
  title: "Free design learning paths, step by step | Matr Studio",
  description:
    "Every path strings the best free videos, articles and docs into an order that makes sense. Pick a topic, mark each lesson done and finish it.",
  path: ROUTES.paths,
});

export default function PathsPage() {
  const catalogue = getCatalogue();
  const { paths } = getBrowsePaths(catalogue);
  return (
    <main>
      <PageHero
        id="paths-heading"
        eyebrow="Learning paths"
        title="Free design learning paths, step by step"
        intro="Every path strings the best free videos, articles and docs into an order that makes sense. Pick one, mark each lesson done, and finish it."
      >
        {/* TODO: point at the real sign-up once auth exists. */}
        <a href="#get-started" className={BUTTON_PRIMARY}>
          <span className="px-0.5">Get started free</span>
        </a>
        <Link href={ROUTES.library} className={BUTTON_SECONDARY}>
          <span className="px-0.5">Browse the library</span>
        </Link>
      </PageHero>

      <section
        aria-labelledby="all-paths-heading"
        className="border-border-soft border-t px-5 lg:px-8"
      >
        <div className="mx-auto flex max-w-[1240px] flex-col gap-10 border-border-soft border-r border-l px-4 py-12 md:px-10 xl:py-24">
          <h2 id="all-paths-heading" className="sr-only">
            All paths
          </h2>
          <PathsBrowser paths={paths} topics={catalogue.topics} />
        </div>
      </section>

      <PathsCta />
    </main>
  );
}
