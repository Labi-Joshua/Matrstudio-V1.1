import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

// Generated once at build time into out/robots.txt (required for output: "export").
export const dynamic = "force-static";

// Everything stays crawlable: the verification pages opt out with a noindex meta tag, which
// crawlers can only see if they are allowed to fetch the page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
