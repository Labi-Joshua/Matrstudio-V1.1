/**
 * Copy for /mission, verbatim from Figma "Marketing pages (V3)" > Page · Our mission (778:7902).
 * (The waitlist app's mission page has different wording; see the hand-off notes.)
 */
export const MISSION_HERO = {
  eyebrow: "Our mission",
  title: "Elevating the craft of design, together.",
  body: "Matr Studio turns the best free resources on the web into clear learning paths, so anyone can master their craft without a paywall.",
  primaryCta: "Get started free",
  secondaryCta: "Browse paths",
} as const;

export type PillarTone = "primary" | "success" | "warning";

export const MISSION_YARDSTICK = {
  eyebrow: "Our yardstick",
  title: "A place built on clarity and shared growth.",
  pillars: [
    {
      title: "Discover the standard",
      body: "Refine your craft with curated learning paths, industry-standard tools and reviewed resources.",
      tone: "primary",
    },
    {
      title: "Shape the library",
      body: "Recommend the links that taught you something. Every submission is reviewed to keep the bar high.",
      tone: "success",
    },
    {
      title: "Curate your growth",
      body: "Save paths and lessons, track your progress and come back to what matters.",
      tone: "warning",
    },
  ],
} as const satisfies {
  eyebrow: string;
  title: string;
  pillars: { title: string; body: string; tone: PillarTone }[];
};

export const MISSION_PRINCIPLES = {
  eyebrow: "What we believe",
  items: [
    {
      title: "Free, always",
      body: "Every lesson links to a free, open source. No paywalls, no trials, no upsells.",
    },
    {
      title: "Credit stays with creators",
      body: "We put lessons in order. The people who made them keep the views and the credit.",
    },
    {
      title: "Finish what you start",
      body: "Every path has an end. Mark the last lesson done and it’s finished.",
    },
  ],
} as const;

export const MISSION_CTA = {
  title: "We’re building the hub to learn, build and grow.",
  body: "Start with a free path today. No card, no trial.",
  primaryCta: "Get started free",
  secondaryCta: "Browse paths",
} as const;

export const MISSION_SHOWCASE_ALT =
  "The Matr Studio home screen: a greeting, the path you are in the middle of, and your learning paths.";
