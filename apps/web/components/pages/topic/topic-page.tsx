import type { CSSProperties } from "react";
import type { Catalogue, TopicSlug } from "../../../lib/catalogue/types";
import { ROUTES } from "../../../lib/routes";
import { SITE_URL } from "../../../lib/site";
import { TOPIC_LOOK } from "../../landing/at-work-art";
import { TopicAbout } from "./topic-about";
import { TopicCta, TopicOthers } from "./topic-closing";
import { TopicHero } from "./topic-hero";
import { TopicPaths } from "./topic-paths";
import { TopicResources } from "./topic-resources";
import { buildTopicPageView } from "./topic-view";

/**
 * One template for the seven topic pages (Figma "Marketing pages (V3)": Page · Topic · <name>).
 * The copy is TOPIC_CONTENT[slug]; paths, lessons, hours and resources come from the catalogue.
 * --h is the topic's colour (hero tiles, quote panel, eyebrow, ticks) and --hc the hue of its
 * path covers, both from TOPIC_LOOK so they match the "At work" accordion on the landing page.
 * Exactly one h1 (the hero), h2 per section.
 */
export function TopicPage({ catalogue, slug }: { catalogue: Catalogue; slug: TopicSlug }) {
  const view = buildTopicPageView(catalogue, slug);
  const look = TOPIC_LOOK[slug];
  const style = { "--h": look.panel, "--hc": look.cover } as CSSProperties;

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}${ROUTES.home}` },
      { "@type": "ListItem", position: 2, name: "Paths", item: `${SITE_URL}${ROUTES.paths}` },
      {
        "@type": "ListItem",
        position: 3,
        name: view.content.name,
        item: `${SITE_URL}${ROUTES.topic(slug)}`,
      },
    ],
  };

  return (
    <main style={style}>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD built from our own data, "<" escaped
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c"),
        }}
      />
      <TopicHero view={view} />
      <TopicAbout view={view} />
      <TopicPaths view={view} />
      <TopicResources view={view} />
      <TopicOthers view={view} />
      <TopicCta view={view} />
    </main>
  );
}
