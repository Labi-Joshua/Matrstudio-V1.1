import type { MetadataRoute } from "next";
import { getCatalogue } from "../lib/catalogue/data";
import { ROUTES } from "../lib/routes";
import { SITE_URL } from "../lib/site";

// Generated once at build time into out/sitemap.xml (required for output: "export").
export const dynamic = "force-static";

/**
 * Public pages only: the landing page, the browse pages, the company and legal pages, and one
 * page per catalogue topic (/paths/{topic}), from the same data that drives the landing page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (
    path: string,
    changeFrequency: "weekly" | "monthly" | "yearly",
    priority: number,
  ) => ({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency, priority });

  return [
    page(ROUTES.home, "weekly", 1),
    page(ROUTES.paths, "weekly", 0.9),
    ...getCatalogue().topics.map((topic) => page(ROUTES.topic(topic.slug), "weekly", 0.8)),
    page(ROUTES.library, "weekly", 0.8),
    page(ROUTES.saved, "monthly", 0.5),
    page(ROUTES.submit, "monthly", 0.5),
    page(ROUTES.mission, "monthly", 0.6),
    page(ROUTES.help, "monthly", 0.5),
    page(ROUTES.terms, "yearly", 0.3),
    page(ROUTES.privacy, "yearly", 0.3),
  ];
}
