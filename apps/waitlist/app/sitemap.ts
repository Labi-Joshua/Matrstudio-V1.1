import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

// Generated once at build time into out/sitemap.xml (required for output: "export").
export const dynamic = "force-static";

/**
 * Only the landing page is listed. /verified and /verify-failed are the targets of
 * confirmation-email links and are marked noindex, so they stay out of search results.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
