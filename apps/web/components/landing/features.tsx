/**
 * Figma "Product landing page · V3": Features 740:34847 (desktop dark; light 738:26765), mobile
 * 741:38873 (light 739:31193). Heading 740:34849 and four alternating rows (752:44690). The
 * illustrations (coloured tile pattern + a product screen) are exported from Figma as PNG at 2x,
 * one per theme and per layout, because the mobile frame uses different screens from the desktop
 * one. Layout: stacked below xl (copy, then the illustration), side by side from xl with the
 * illustration alternating left/right, matching the pixel-exact desktop frame.
 */
import Link from "next/link";
import type { CSSProperties } from "react";
import { ROUTES } from "../../lib/routes";
import { StackedCards } from "./stacked-cards";

type FeatureLink = { label: string; href: string };
type Feature = {
  title: string;
  body: string;
  links: FeatureLink[];
  /** Image file number: /images/features/{desktop|mobile}-{light|dark}-{n}.png */
  n: 1 | 2 | 3 | 4;
  alt: string;
};

const FEATURES: Feature[] = [
  {
    title: "We find the lessons. You take them.",
    body: "Every path strings free videos, articles and docs into an order that makes sense, from your first wireframe to a shipped design system.",
    links: [{ label: "Discover paths", href: ROUTES.paths }],
    n: 1,
    alt: "A Matr Studio learning path, UI/UX Design Foundations, with its 10 lessons and where each comes from",
  },
  {
    title: "We sort the library. You search it.",
    body: "Every resource is tagged by topic, format and source, so the one video you need is a search away.",
    links: [{ label: "Browse the library", href: ROUTES.library }],
    n: 2,
    alt: "Library search results for design systems, split into paths and resources",
  },
  {
    title: "We keep track. You keep going.",
    body: "Mark a lesson done and your progress updates everywhere. Bookmark anything you want to come back to.",
    links: [
      { label: "See your progress", href: ROUTES.paths },
      { label: "Open saved", href: ROUTES.saved },
    ],
    n: 3,
    alt: "The Matr Studio home screen with a lesson to resume, your paths and saved resources",
  },
  {
    title: "You share what taught you. We check it.",
    body: "Submit a free resource you learned from. Reviewers look at every link before it goes into a path.",
    links: [{ label: "Submit a resource", href: ROUTES.submit }],
    n: 4,
    alt: "A submitted resource waiting in review, with other submissions and their status",
  },
];

function ChevronRight() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

/** Light/dark pair for one layout; the wrapper decides which layout shows. */
function ThemedImage({
  layout,
  n,
  alt,
  width,
  height,
  className,
}: {
  layout: "desktop" | "mobile";
  n: number;
  alt: string;
  width: number;
  height: number;
  className: string;
}) {
  return (
    <>
      <img
        src={`/images/features/${layout}-light-${n}.png`}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={`dark:hidden ${className}`}
      />
      <img
        src={`/images/features/${layout}-dark-${n}.png`}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={`hidden dark:block ${className}`}
      />
    </>
  );
}

function Row({ feature, flip, index }: { feature: Feature; flip: boolean; index: number }) {
  return (
    <div
      data-stack-card=""
      data-no-reveal=""
      style={{ "--i": index } as CSSProperties}
      className={`stack-card flex flex-col gap-5 border-border-soft border-t px-4 pt-[29px] pb-7 md:gap-8 md:px-10 md:pt-12 md:pb-12 xl:items-center xl:justify-between xl:gap-12 xl:px-12 xl:py-[49px] ${
        flip ? "xl:flex-row-reverse" : "xl:flex-row"
      }`}
    >
      <div className="flex flex-col items-start gap-3 md:mx-auto md:w-full md:max-w-[480px] xl:mx-0 xl:w-[360px] xl:max-w-none xl:shrink-0 xl:gap-4">
        <h3 className="font-medium text-[28px] text-text leading-[34px] tracking-[-0.28px] xl:text-[40px] xl:leading-[46px] xl:tracking-[-0.4px]">
          {feature.title}
        </h3>
        <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px] xl:text-[18px] xl:leading-7 xl:tracking-[-0.18px]">
          {feature.body}
        </p>
        <div className="flex flex-col items-start xl:pt-2">
          {feature.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="link-slide flex items-center gap-2 py-1.5 font-semibold text-[16px] text-text leading-6 tracking-[-0.16px] xl:py-2"
            >
              {link.label}
              <ChevronRight />
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[480px] xl:hidden">
        <ThemedImage
          layout="mobile"
          n={feature.n}
          alt={feature.alt}
          width={356}
          height={460}
          className="h-auto w-full"
        />
      </div>
      <div className="hidden shrink-0 xl:block">
        <ThemedImage
          layout="desktop"
          n={feature.n}
          alt={feature.alt}
          width={734}
          height={560}
          className="h-[560px] w-[734px] max-w-none"
        />
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" aria-labelledby="features-heading" className="px-5 lg:px-8">
      <div className="mx-auto max-w-[1240px] border-border-soft border-r border-l">
        <div className="flex flex-col items-center px-4 pt-14 pb-8 md:px-10 md:pt-20 md:pb-12 xl:pt-28 xl:pb-[72px]">
          <h2
            id="features-heading"
            className="max-w-[720px] text-center font-medium text-[32px] text-text leading-[38px] tracking-[-0.32px] md:text-[44px] md:leading-[50px] md:tracking-[-0.44px] xl:text-[56px] xl:leading-[62px] xl:tracking-[-0.56px]"
          >
            Matr Studio lets you decide how you learn.
          </h2>
        </div>
        <StackedCards>
          {FEATURES.map((feature, index) => (
            <Row key={feature.title} feature={feature} flip={index % 2 === 1} index={index} />
          ))}
        </StackedCards>
      </div>
    </section>
  );
}
