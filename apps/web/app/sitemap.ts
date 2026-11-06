import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

// Generated once at build time into out/sitemap.xml (required for output: "export").
export const dynamic = "force-static";

/**
 * Public pages only. Each topic page (/paths/{topic}) is added here when those pages exist, from
 * the same catalogue data that drives the landing page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
  ];
}
