/**
 * Canonical public URL of the waitlist, used for the sitemap, robots.txt and canonical links.
 * matrstudio.com is the primary domain; www and the vercel.app URL serve the same site.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://matrstudio.com").replace(
  /\/+$/,
  "",
);
