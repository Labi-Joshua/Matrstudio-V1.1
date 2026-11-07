/**
 * Every internal page of the marketing site, in one place, so nav, footer and in-page links
 * all point at the same URLs. Topic pages live under /paths/{topic} (AGENTS.md SEO notes) and
 * use the catalogue topic slugs.
 */
export const ROUTES = {
  home: "/",
  paths: "/paths",
  library: "/library",
  saved: "/saved",
  submit: "/submit",
  mission: "/mission",
  help: "/help",
  terms: "/terms",
  privacy: "/privacy",
  topic: (slug: string) => `/paths/${slug}`,
} as const;
