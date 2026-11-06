import type { Catalogue } from "./types";

// Placeholder catalogue for the landing page, replaced by D1 when packages/db exists. The page
// reads it only through getCatalogue(), so that swap changes this file and nothing else.
//
// Topics and sources are from AGENTS.md (§1, §7, §9). Paths, lessons and resources stay empty
// until the Figma path catalogue (the 8 launch paths) can be read: path titles, descriptions and
// lesson lists must come from it, not from guesses.

export const catalogue: Catalogue = {
  topics: [
    { slug: "ui-ux", name: "UI/UX" },
    { slug: "brand", name: "Brand" },
    { slug: "product", name: "Product" },
    { slug: "seo", name: "SEO" },
    { slug: "social-media", name: "Social media design" },
    { slug: "design-systems", name: "Design systems" },
    { slug: "dev-handoff", name: "Dev handoff" },
  ],
  // The first six are the source strip in the design; ordering by resource count takes over once
  // there are resources (ties keep this order).
  sources: [
    { slug: "youtube", name: "YouTube", domain: "youtube.com" },
    { slug: "medium", name: "Medium", domain: "medium.com" },
    { slug: "figma", name: "Figma", domain: "figma.com" },
    { slug: "smashing-magazine", name: "Smashing Magazine", domain: "smashingmagazine.com" },
    { slug: "mdn", name: "MDN Web Docs", domain: "developer.mozilla.org" },
    { slug: "freecodecamp", name: "freeCodeCamp", domain: "freecodecamp.org" },
    { slug: "nielsen-norman-group", name: "Nielsen Norman Group", domain: "nngroup.com" },
    { slug: "moz", name: "Moz", domain: "moz.com" },
  ],
  resources: [],
  paths: [],
  pathLessons: [],
};

/** The one way the landing page gets its data. */
export function getCatalogue(): Catalogue {
  return catalogue;
}
