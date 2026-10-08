import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

// Generated once at build time into out/sitemap.xml (required for output: "export").
export const dynamic = "force-static";

/**
 * The public pages: the landing page and Our Mission. The email-confirmation pages
 * (/verified, /verify-already, /verify-expired, /verify-failed) are only reached from
 * confirmation links and are marked noindex, so they stay out of the sitemap and search results.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/mission`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
