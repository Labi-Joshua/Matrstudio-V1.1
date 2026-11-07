import type { CSSProperties, ReactNode } from "react";
import type { TopicSlug } from "../../lib/catalogue/types";

/**
 * Figma "Path Card" cover (Path Cover 316:102): generated art, one per topic, drawn from a single
 * hue. Everything is derived from the hue with color-mix against the theme background, so it follows
 * light and dark without hard-coded colours.
 *
 * Hue tokens: utility/Violet Blue, Green and Amber keys are not in the theme yet, so they fall back
 * to the closest existing utility colour until `--matr-violet-blue`, `--matr-green` and
 * `--matr-amber` are added.
 */
const HUE = {
  orange: "var(--matr-orange)",
  blue: "var(--matr-blue)",
  fuchsia: "var(--matr-fuchsia)",
  purple: "var(--matr-purple)",
  teal: "var(--matr-teal)",
  violetBlue: "var(--matr-violet-blue, var(--matr-purple))",
  green: "var(--matr-green, var(--matr-emerald))",
  emerald: "var(--matr-emerald)",
  amber: "var(--matr-amber, var(--matr-orange))",
} as const;

export type TopicLook = {
  /** Colour of the topic's quote panel (Figma Panel · <topic>). */
  panel: string;
  /** Hue of the path cover art for paths in this topic. */
  cover: string;
};

export const TOPIC_LOOK: Record<TopicSlug, TopicLook> = {
  "ui-ux": { panel: HUE.orange, cover: HUE.violetBlue },
  brand: { panel: HUE.purple, cover: HUE.orange },
  product: { panel: HUE.blue, cover: HUE.blue },
  seo: { panel: HUE.emerald, cover: HUE.green },
  "social-media": { panel: HUE.fuchsia, cover: HUE.fuchsia },
  "design-systems": { panel: HUE.teal, cover: HUE.teal },
  "dev-handoff": { panel: HUE.violetBlue, cover: HUE.amber },
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Lucide-style glyphs for the cover's icon tile. */
const ICONS: Record<TopicSlug, ReactNode> = {
  "ui-ux": (
    <>
      <rect x="3" y="3" width="18" height="7" rx="1.5" />
      <rect x="3" y="14" width="8" height="7" rx="1.5" />
      <rect x="15" y="14" width="6" height="7" rx="1.5" />
    </>
  ),
  brand: (
    <>
      <path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4.5 4H15a2 2 0 0 0-1.5 3.3c.6.8.3 2.7-1.5 2.7Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="11" cy="7" r="1" />
      <circle cx="16" cy="8" r="1" />
    </>
  ),
  product: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </>
  ),
  seo: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
  "social-media": (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  "design-systems": (
    <>
      <path d="m12 3 9 5-9 5-9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  "dev-handoff": (
    <>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
    </>
  ),
};

export function TopicIcon({ topic, size }: { topic: TopicSlug; size: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...stroke}>
      {ICONS[topic]}
    </svg>
  );
}

export function ChevronDown({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function StarOutline() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z" />
    </svg>
  );
}

export function BookIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** The 340 x 180 cover. Shapes use the Figma insets as percentages so they scale with the card. */
export function PathCover({ topic, hue }: { topic: TopicSlug; hue: string }) {
  const style = { "--h": hue } as CSSProperties;
  return (
    <div
      aria-hidden="true"
      style={style}
      className="relative h-[180px] w-full shrink-0 overflow-clip bg-[color-mix(in_srgb,var(--h)_14%,var(--matr-bg-base))]"
    >
      <div className="absolute inset-[22.22%_-25%_-50%_53.13%] rounded-full bg-[color-mix(in_srgb,var(--h)_26%,var(--matr-bg-base))]" />
      <div className="absolute inset-[-27.78%_71.88%_55.56%_-12.5%] rounded-full bg-[color-mix(in_srgb,var(--h)_22%,var(--matr-bg-base))]" />
      <div className="absolute inset-[49.82%_54.43%_-6.39%_13.75%] -rotate-14 rounded-[20px] bg-[color-mix(in_srgb,var(--h)_55%,var(--matr-bg-base))]" />
      <div className="absolute top-[14.44%] left-[66.25%] size-3.5 rounded-full bg-(--h)" />
      <div className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[18px] bg-bg-base text-(--h) shadow-e2">
        <TopicIcon topic={topic} size={30} />
      </div>
    </div>
  );
}
