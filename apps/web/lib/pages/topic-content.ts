import type { Level, ResourceFormat, TopicSlug } from "../catalogue/types";

/**
 * Marketing copy of the seven topic pages ("Marketing pages (V3)" in Figma, one page per topic,
 * each with Desktop / Mobile x Light / Dark frames). Headlines, descriptions, "What you'll learn"
 * lists and CTA text are copied from the frames. The colour hue comes from TOPIC_LOOK
 * (components/landing/at-work-art.tsx), not from here.
 *
 * Paths, lessons and resources are NOT marketing copy: the page reads them from the catalogue
 * (getCatalogue + derive.ts). `sample` holds what the Figma frames show for those blocks, as
 * design sample data only. It is used while the catalogue has no published paths for the topic and
 * USE_SAMPLE_WHEN_EMPTY is true; set that flag to false (or delete `sample`) once the catalogue is
 * filled, and the page renders only real data.
 */
export const USE_SAMPLE_WHEN_EMPTY = true;

export type SamplePath = {
  title: string;
  description: string;
  level: Level;
  lessons: number;
  hours: number;
};

export type SampleResource = {
  title: string;
  source: string;
  format: ResourceFormat;
  /** Length as shown on the card ("15:04"). */
  length: string;
  /** Second line of the card ("UI/UX · Beginner"). */
  meta: string;
};

export type TopicSample = {
  stats: { paths: number; lessons: number; hours: number; levels: Level[] };
  /** Quote in the colour panel and the path it is taken from. */
  quote: string;
  sourcePath: string;
  paths: SamplePath[];
  resources: SampleResource[];
};

export type TopicContent = {
  slug: TopicSlug;
  /** Short name used in labels and the "other topics" chips. */
  name: string;
  /** Mono eyebrow above the headline. */
  eyebrow: string;
  /** The page's only h1. */
  title: string;
  intro: string;
  about: {
    heading: string;
    primary: string;
    secondary: string;
    learn: string[];
    who: string;
    tools: string[];
  };
  pathsHeading: string;
  resourcesHeading: string;
  cta: { heading: string; body: string };
  /** <title> and meta description. */
  meta: { title: string; description: string };
  sample: TopicSample;
};

const HERO_INTRO = (name: string) =>
  `Learn ${name} for free with step-by-step paths built from the best free videos, articles and docs. Mark each lesson done and finish the path.`;
const CTA_BODY = "Free forever, no card. Create an account to track your progress.";

const level = (...levels: Level[]) => levels;

export const TOPIC_CONTENT: Record<TopicSlug, TopicContent> = {
  "ui-ux": {
    slug: "ui-ux",
    name: "UI/UX",
    eyebrow: "TOPIC · UI/UX",
    title: "Free UI/UX design courses",
    intro: HERO_INTRO("UI/UX design"),
    about: {
      heading: "What is UI/UX design?",
      primary:
        "UI/UX design is how a product looks and how it works for the people using it. UI (user interface) covers layout, type, colour and components. UX (user experience) covers research, flows and whether people can get things done easily.",
      secondary:
        "Good UI/UX makes products easier to learn, faster to use and more accessible to everyone. It’s the starting point for most product and web design roles.",
      learn: [
        "Visual hierarchy, layout and grids",
        "Typography and colour for interfaces",
        "User flows and wireframes",
        "Prototyping in Figma",
        "Usability testing basics",
        "Accessibility and colour contrast",
      ],
      who: "Beginners, career switchers and developers who want to design better interfaces.",
      tools: ["Figma", "FigJam", "Miro"],
    },
    pathsHeading: "UI/UX learning paths",
    resourcesHeading: "Free UI/UX design resources in the library",
    cta: { heading: "Start learning UI/UX design today", body: CTA_BODY },
    meta: {
      title: "Free UI/UX design courses and learning paths",
      description:
        "Learn UI/UX design for free with step-by-step paths built from the best free videos, articles and docs. Mark each lesson done and finish the path.",
    },
    sample: {
      stats: { paths: 2, lessons: 22, hours: 16, levels: level("beginner", "advanced") },
      quote: "Go from layout basics to a tested prototype using free videos and articles.",
      sourcePath: "UI/UX Design Foundations",
      paths: [
        {
          title: "UI/UX Design Foundations",
          description:
            "Go from layout basics to a tested prototype using free videos and articles.",
          level: "beginner",
          lessons: 12,
          hours: 8,
        },
        {
          title: "Advanced Prototyping",
          description: "Smart animate, variables and conditional logic for realistic prototypes.",
          level: "advanced",
          lessons: 10,
          hours: 8,
        },
      ],
      resources: [
        {
          title: "Mapping user flows",
          source: "YouTube",
          format: "video",
          length: "15:04",
          meta: "UI/UX · Beginner",
        },
        {
          title: "Auto layout, explained",
          source: "Figma",
          format: "video",
          length: "12:20",
          meta: "UI/UX · Beginner",
        },
        {
          title: "Writing UX copy that helps",
          source: "Medium",
          format: "article",
          length: "6 min read",
          meta: "UI/UX · Beginner",
        },
        {
          title: "Colour contrast checker",
          source: "WebAIM",
          format: "tool",
          length: "Free tool",
          meta: "UI/UX · Beginner",
        },
        {
          title: "Typography basics for UI",
          source: "YouTube",
          format: "video",
          length: "16:40",
          meta: "UI/UX · Beginner",
        },
      ],
    },
  },
  brand: {
    slug: "brand",
    name: "Brand",
    eyebrow: "TOPIC · BRAND",
    title: "Free brand design courses",
    intro: HERO_INTRO("brand design"),
    about: {
      heading: "What is brand design?",
      primary:
        "Brand design is the visual identity of a company or product: its logo, colours, type, imagery and the rules that keep them consistent everywhere they appear.",
      secondary:
        "A clear identity makes a brand easy to recognise and trust, from a website to a social post to packaging.",
      learn: [
        "Brand strategy and positioning basics",
        "Logo design principles",
        "Colour and type systems",
        "Building a one-page brand guideline",
        "Applying a brand across touchpoints",
      ],
      who: "Designers starting freelance work, founders building a first brand, and UI designers who want stronger visual skills.",
      tools: ["Figma", "Illustrator", "Photoshop"],
    },
    pathsHeading: "Brand learning paths",
    resourcesHeading: "Free brand design resources in the library",
    cta: { heading: "Start learning brand design today", body: CTA_BODY },
    meta: {
      title: "Free brand design courses and learning paths",
      description:
        "Learn brand design for free: logos, colour, type and brand guidelines, with step-by-step paths built from the best free videos, articles and docs.",
    },
    sample: {
      stats: { paths: 1, lessons: 9, hours: 6, levels: level("beginner") },
      quote: "Build a simple brand: logo, colour, type and a one-page guideline.",
      sourcePath: "Brand Identity Basics",
      paths: [
        {
          title: "Brand Identity Basics",
          description: "Build a simple brand: logo, colour, type and a one-page guideline.",
          level: "beginner",
          lessons: 9,
          hours: 6,
        },
      ],
      resources: [
        {
          title: "Colour theory for designers",
          source: "YouTube",
          format: "video",
          length: "22:15",
          meta: "Brand · Beginner",
        },
      ],
    },
  },
  product: {
    slug: "product",
    name: "Product",
    eyebrow: "TOPIC · PRODUCT",
    title: "Free product design courses",
    intro: HERO_INTRO("product design"),
    about: {
      heading: "What is product design?",
      primary:
        "Product design is solving real problems for users and the business. It covers understanding the problem, talking to users, mapping flows and shipping features with engineers.",
      secondary:
        "Product designers help decide what gets built, not just how it looks, which makes the role central to most tech teams.",
      learn: [
        "Framing a product problem",
        "User interviews and insights",
        "Journey maps and user flows",
        "Prototyping and testing ideas",
        "Working with PMs and engineers",
      ],
      who: "UI designers moving into product roles, and anyone who wants to design features end to end.",
      tools: ["Figma", "FigJam", "Miro", "Notion"],
    },
    pathsHeading: "Product learning paths",
    resourcesHeading: "Free product design resources in the library",
    cta: { heading: "Start learning product design today", body: CTA_BODY },
    meta: {
      title: "Free product design courses and learning paths",
      description:
        "Learn product design for free: frame problems, run user research, map flows and ship features, with paths built from the best free videos, articles and docs.",
    },
    sample: {
      stats: { paths: 1, lessons: 10, hours: 7, levels: level("beginner") },
      quote: "Learn how product designers frame problems, map flows and ship features.",
      sourcePath: "Product Design Essentials",
      paths: [
        {
          title: "Product Design Essentials",
          description: "Learn how product designers frame problems, map flows and ship features.",
          level: "beginner",
          lessons: 10,
          hours: 7,
        },
      ],
      resources: [
        {
          title: "Turning research into insights",
          source: "NN/g",
          format: "article",
          length: "8 min read",
          meta: "Product · Beginner",
        },
        {
          title: "FigJam templates for workshops",
          source: "Figma",
          format: "tool",
          length: "Free tool",
          meta: "Product · Beginner",
        },
        {
          title: "Journey mapping board",
          source: "Miro",
          format: "tool",
          length: "Free tool",
          meta: "Product · Beginner",
        },
        {
          title: "How to run a usability test",
          source: "NN/g",
          format: "article",
          length: "10 min read",
          meta: "Product · Beginner",
        },
      ],
    },
  },
  seo: {
    slug: "seo",
    name: "SEO",
    eyebrow: "TOPIC · SEO",
    title: "Free SEO courses for designers",
    intro: HERO_INTRO("SEO"),
    about: {
      heading: "What is SEO?",
      primary:
        "SEO (search engine optimisation) is making pages easy for search engines to understand and easy for people to find. For designers, it comes down to structure, content, speed and accessibility.",
      secondary:
        "Most people find websites through search. Designers who understand SEO make pages that rank, load fast and turn visitors into users.",
      learn: [
        "How search engines crawl and rank pages",
        "Page structure and headings",
        "Writing titles and meta descriptions",
        "Images, speed and Core Web Vitals",
        "Designing landing pages that rank",
      ],
      who: "Web designers, marketing designers and anyone shipping landing pages.",
      tools: ["Google Search Console", "PageSpeed Insights"],
    },
    pathsHeading: "SEO learning paths",
    resourcesHeading: "Free SEO resources in the library",
    cta: { heading: "Start learning SEO today", body: CTA_BODY },
    meta: {
      title: "Free SEO courses for designers and learning paths",
      description:
        "Learn SEO for free as a designer: page structure, titles, speed and landing pages that rank, with paths built from the best free videos, articles and docs.",
    },
    sample: {
      stats: { paths: 1, lessons: 7, hours: 4, levels: level("beginner") },
      quote: "Understand how search works and design pages people and search engines can find.",
      sourcePath: "SEO for Designers",
      paths: [
        {
          title: "SEO for Designers",
          description:
            "Understand how search works and design pages people and search engines can find.",
          level: "beginner",
          lessons: 7,
          hours: 4,
        },
      ],
      resources: [
        {
          title: "SEO basics for designers",
          source: "Moz",
          format: "article",
          length: "9 min read",
          meta: "SEO · Beginner",
        },
      ],
    },
  },
  "social-media": {
    slug: "social-media",
    name: "Social media design",
    eyebrow: "TOPIC · SOCIAL MEDIA DESIGN",
    title: "Free social media design courses",
    intro: HERO_INTRO("social media design"),
    about: {
      heading: "What is social media design?",
      primary:
        "Social media design is creating posts, carousels, stories and short videos that stop the scroll and stay on brand across every platform.",
      secondary:
        "Social is often where a brand meets its audience first. Consistent, well-designed content builds recognition and keeps people engaged.",
      learn: [
        "Platform sizes and safe zones",
        "Carousel and story layouts",
        "Type and hierarchy for small screens",
        "Templates that keep content on brand",
        "Simple motion for posts",
      ],
      who: "Content creators, brand designers and marketing teams.",
      tools: ["Figma", "Canva", "Photoshop"],
    },
    pathsHeading: "Social media design learning paths",
    // The Figma frame has no resources section for this topic (no sample resources below).
    resourcesHeading: "Free social media design resources in the library",
    cta: { heading: "Start learning social media design today", body: CTA_BODY },
    meta: {
      title: "Free social media design courses and learning paths",
      description:
        "Learn social media design for free: posts, carousels and stories that stay on brand, with paths built from the best free videos, articles and docs.",
    },
    sample: {
      stats: { paths: 1, lessons: 8, hours: 5, levels: level("beginner") },
      quote: "Design posts, carousels and stories that stay on brand and get noticed.",
      sourcePath: "Social Media Design",
      paths: [
        {
          title: "Social Media Design",
          description: "Design posts, carousels and stories that stay on brand and get noticed.",
          level: "beginner",
          lessons: 8,
          hours: 5,
        },
      ],
      resources: [],
    },
  },
  "design-systems": {
    slug: "design-systems",
    name: "Design systems",
    eyebrow: "TOPIC · DESIGN SYSTEMS",
    title: "Free design systems courses",
    intro: HERO_INTRO("design systems"),
    about: {
      heading: "What is design systems?",
      primary:
        "A design system is a shared library of tokens, components and guidelines that keeps a product consistent and helps teams design and build faster.",
      secondary:
        "Systems cut repeated work, keep products consistent across teams and make the step from design to code much smoother.",
      learn: [
        "Design tokens for colour, type and spacing",
        "Building components with variants",
        "Auto layout and variables in Figma",
        "Documentation people actually use",
        "Maintaining a shared library",
      ],
      who: "Product designers on growing teams and developers who work closely with design.",
      tools: ["Figma", "Storybook", "Tokens Studio"],
    },
    pathsHeading: "Design systems learning paths",
    resourcesHeading: "Free design systems resources in the library",
    cta: { heading: "Start learning design systems today", body: CTA_BODY },
    meta: {
      title: "Free design systems courses and learning paths",
      description:
        "Learn design systems for free: tokens, components and documentation, with step-by-step paths built from the best free videos, articles and docs.",
    },
    sample: {
      stats: { paths: 1, lessons: 11, hours: 9, levels: level("intermediate") },
      quote: "Tokens, components and documentation, from a single button to a shared library.",
      sourcePath: "Design Systems 101",
      paths: [
        {
          title: "Design Systems 101",
          description:
            "Tokens, components and documentation, from a single button to a shared library.",
          level: "intermediate",
          lessons: 11,
          hours: 9,
        },
      ],
      resources: [
        {
          title: "Design tokens in practice",
          source: "YouTube",
          format: "video",
          length: "18:32",
          meta: "Design systems · Beginner",
        },
      ],
    },
  },
  "dev-handoff": {
    slug: "dev-handoff",
    name: "Dev handoff",
    eyebrow: "TOPIC · DEV HANDOFF",
    title: "Free dev handoff courses",
    intro: HERO_INTRO("dev handoff"),
    about: {
      heading: "What is dev handoff?",
      primary:
        "Dev handoff is how designers pass work to developers: specs, assets, tokens and notes that make a design buildable without guesswork.",
      secondary:
        "Clear handoff means fewer bugs, fewer back-and-forths and a shipped product that matches the design.",
      learn: [
        "Preparing files and naming layers",
        "Specs, spacing and redlines",
        "Exporting assets and icons",
        "Tokens and variables developers can use",
        "Using Dev Mode and annotations",
      ],
      who: "Designers who work with engineers, and developers who want to read design files with confidence.",
      tools: ["Figma Dev Mode", "GitHub"],
    },
    pathsHeading: "Dev handoff learning paths",
    resourcesHeading: "Free dev handoff resources in the library",
    cta: { heading: "Start learning dev handoff today", body: CTA_BODY },
    meta: {
      title: "Free dev handoff courses and learning paths",
      description:
        "Learn dev handoff for free: specs, redlines, tokens and annotations developers love, with paths built from the best free videos, articles and docs.",
    },
    sample: {
      stats: { paths: 1, lessons: 8, hours: 5, levels: level("intermediate") },
      quote: "Prepare files developers love: specs, redlines, tokens and annotations.",
      sourcePath: "Dev Handoff",
      paths: [
        {
          title: "Dev Handoff",
          description: "Prepare files developers love: specs, redlines, tokens and annotations.",
          level: "intermediate",
          lessons: 8,
          hours: 5,
        },
      ],
      resources: [],
    },
  },
};
