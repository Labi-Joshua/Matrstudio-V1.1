/**
 * Canonical public URL, used for the sitemap, robots.txt and canonical links. matrstudio.com is
 * the primary domain (www redirects to it). Set NEXT_PUBLIC_SITE_URL when building a preview, so
 * a preview never claims matrstudio.com.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://matrstudio.com").replace(
  /\/+$/,
  "",
);

export const SITE_NAME = "Matr Studio";

/**
 * Link-preview image (Figma Social Preview, OG Image / Light), 1200 x 630. A shared link shows one
 * image whatever theme the viewer uses, so the light version is the default; the dark one sits
 * next to it as matr-studio-dark.png.
 */
const OG_IMAGE = {
  url: "/images/og/matr-studio-light.png",
  width: 1200,
  height: 630,
  alt: "Matr Studio: free learning paths for designers and developers",
};

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
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
    },
  };
}
