/**
 * Canonical public URL of the waitlist, used for the sitemap, robots.txt and canonical links.
 * matrstudio.com is the primary domain; www and the vercel.app URL serve the same site.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://matrstudio.com").replace(
  /\/+$/,
  "",
);

export const SITE_NAME = "Matr Studio";

/** Homepage title and description: what the product is, in the words people search with. */
export const HOME_TITLE = "Matr Studio | Design Community for Product Designers";
export const HOME_DESCRIPTION =
  "Matr Studio is a design community and learning hub for product designers: learning paths, chat rooms and curated UI/UX resources. Join early access.";

/**
 * Link-preview image (Figma: Social Preview, OG Image / Light 218:18), 1200 x 630. A shared link
 * shows one image whatever theme the viewer uses, so the light version is the default; the dark
 * frame (222:106) is saved next to it as matr-studio-dark.png if we ever want to swap.
 */
const OG_IMAGE = {
  url: "/images/og/matr-studio-light.png",
  width: 1200,
  height: 630,
  alt: "Matr Studio: the collaborative learning hub and design community for product designers",
};

/**
 * Metadata for a public page: title, description, canonical URL, and the Open Graph / Twitter
 * tags that decide how a link looks when shared. Each page passes its own, because a page that
 * sets openGraph replaces (not merges with) the layout's.
 */
export function pageMeta({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  /** Path from the site root, "/" for the homepage. */
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
