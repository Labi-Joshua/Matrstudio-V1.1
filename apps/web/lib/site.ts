/**
 * Canonical public URL, used for the sitemap, robots.txt and canonical links. While the product
 * is being built, set NEXT_PUBLIC_SITE_URL to the preview address so previews never claim
 * matrstudio.com (which still serves the waitlist).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://matrstudio.com").replace(
  /\/+$/,
  "",
);

export const SITE_NAME = "Matr Studio";

/**
 * Metadata for a public page: title, description, canonical URL, and the Open Graph / Twitter
 * tags. Each page passes its own, because a page that sets openGraph replaces (not merges with)
 * the layout's. Every page needs a title and a meta description (AGENTS.md, SEO requirements).
 */
export function pageMeta({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  /** Path from the site root, "/" for the home page. */
  path: string;
}) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website" as const,
      siteName: SITE_NAME,
      title,
      description,
      url: path,
      locale: "en_US",
    },
    twitter: { card: "summary_large_image" as const, title, description },
  };
}
