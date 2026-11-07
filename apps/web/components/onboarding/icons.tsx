import type { ReactNode, SVGProps } from "react";
import type { GoalId, LevelId, WelcomeFeatureId } from "../../lib/pages/onboarding-content";

/**
 * Icons of the onboarding screens (the Figma icon set is Lucide, 24px grid, 1.5 stroke), drawn as
 * inline SVG so they take the text colour. Decoration only: always next to text. The topic glyphs
 * come from components/landing/at-work-art.tsx (TopicIcon).
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Glyph({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

const SparklesIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
  </Glyph>
);

const TrendingUpIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M16 7h6v6" />
    <path d="m22 7-8.5 8.5-5-5L2 17" />
  </Glyph>
);

const ShuffleIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
    <path d="m18 2 4 4-4 4" />
    <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
    <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
    <path d="m18 14 4 4-4 4" />
  </Glyph>
);

const HammerIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9" />
    <path d="m18 15 4-4" />
    <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
  </Glyph>
);

const SproutIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M7 20h10" />
    <path d="M10 20c5.5-2.5.8-6.4 3-10" />
    <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
    <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
  </Glyph>
);

const RocketIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </Glyph>
);

export const TargetIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </Glyph>
);

export const LayersIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
    <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
    <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
  </Glyph>
);

export const RouteIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="6" cy="19" r="3" />
    <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
    <circle cx="18" cy="5" r="3" />
  </Glyph>
);

export const LibraryIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m16 6 4 14M12 6v14M8 8v12M4 4v16" />
  </Glyph>
);

export const BookmarkIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </Glyph>
);

export const ShareIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
  </Glyph>
);

export const ChartIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 20V10M18 20V4M6 20v-4" />
  </Glyph>
);

export const BookOpenIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 7v14" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
  </Glyph>
);

export const CircleCheckGlyph = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </Glyph>
);

export const GOAL_ICONS: Record<GoalId, (p: IconProps) => ReactNode> = {
  learn_new_skill: SparklesIcon,
  grow_in_role: TrendingUpIcon,
  switch_careers: ShuffleIcon,
  build_projects: HammerIcon,
};

export const LEVEL_ICONS: Record<LevelId, (p: IconProps) => ReactNode> = {
  beginner: SproutIcon,
  intermediate: TrendingUpIcon,
  advanced: RocketIcon,
};

export const FEATURE_ICONS: Record<WelcomeFeatureId, (p: IconProps) => ReactNode> = {
  paths: RouteIcon,
  library: LibraryIcon,
  collections: BookmarkIcon,
  submit: ShareIcon,
  progress: ChartIcon,
};
