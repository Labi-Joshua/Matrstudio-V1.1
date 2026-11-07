import type { ReactNode, SVGProps } from "react";
import type { LibraryKind } from "../../lib/app/library-data";

/**
 * Small visuals shared by the in-app Library and Saved screens: the generated thumbnail, a few
 * line icons (Lucide style, 24px grid) and the empty / error illustrations. Everything is drawn
 * from design tokens, so it follows light and dark.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Glyph({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
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

export const ExternalIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M15 3h6v6M10 14 21 3M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
  </Glyph>
);

export const PlayIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M7 4.5v15l12-7.5Z" fill="currentColor" />
  </Glyph>
);

export const ToolIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4Z" />
  </Glyph>
);

export const ArticleIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Glyph>
);

export const SlidersIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Glyph>
);

export const CheckIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m5 12 5 5 9-10" />
  </Glyph>
);

export const AlertIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5h.01" />
  </Glyph>
);

export const KIND_ICON: Record<LibraryKind, (p: IconProps) => ReactNode> = {
  video: PlayIcon,
  article: ArticleIcon,
  tool: ToolIcon,
};

/** Type badge colours (Figma Type badge): a tinted fill with the matching utility colour. */
export const KIND_STYLE: Record<LibraryKind, { badge: string; dot: string; label: string }> = {
  video: {
    badge:
      "bg-[color-mix(in_srgb,var(--matr-fuchsia)_16%,var(--matr-bg-base))] text-utility-fuchsia",
    dot: "bg-utility-fuchsia",
    label: "Video",
  },
  article: {
    badge: "bg-[color-mix(in_srgb,var(--matr-blue)_16%,var(--matr-bg-base))] text-utility-blue",
    dot: "bg-utility-blue",
    label: "Article",
  },
  tool: {
    badge:
      "bg-[color-mix(in_srgb,var(--matr-emerald)_16%,var(--matr-bg-base))] text-utility-emerald",
    dot: "bg-utility-emerald",
    label: "Tool",
  },
};

export function TypeBadge({ kind }: { kind: LibraryKind }) {
  const style = KIND_STYLE[kind];
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md py-[3px] pr-1.5 pl-1.5 font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${style.badge}`}
    >
      <span aria-hidden="true" className={`m-[3px] size-1.5 rounded-full ${style.dot}`} />
      <span className="px-0.5">{style.label}</span>
    </span>
  );
}

/** Generated thumbnail (same art as the marketing resource card), one centred glyph per type. */
export function ThumbArt({
  kind,
  className = "h-[180px]",
}: {
  kind: LibraryKind;
  className?: string;
}) {
  const Icon = KIND_ICON[kind];
  const big = className.includes("aspect");
  return (
    <div
      aria-hidden="true"
      className={`relative w-full overflow-clip bg-[color-mix(in_srgb,var(--matr-blue)_14%,var(--matr-bg-base))] ${className}`}
    >
      <div className="absolute inset-[22.22%_-25%_-50%_53.13%] rounded-full bg-[color-mix(in_srgb,var(--matr-blue)_26%,var(--matr-bg-base))]" />
      <div className="absolute inset-[-27.78%_71.88%_55.56%_-12.5%] rounded-full bg-[color-mix(in_srgb,var(--matr-blue)_22%,var(--matr-bg-base))]" />
      <div className="absolute inset-[49.82%_54.43%_-6.39%_13.75%] -rotate-14 rounded-[20px] bg-[color-mix(in_srgb,var(--matr-blue)_55%,var(--matr-bg-base))]" />
      <div className="absolute top-[14.44%] left-[66.25%] size-3.5 rounded-full bg-utility-blue" />
      {kind === "video" ? <div className="absolute inset-0 bg-static-black opacity-35" /> : null}
      <div
        className={`absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-bg-base text-text shadow-e2 ${
          big ? "size-16 rounded-[20px]" : "size-12 rounded-3xl"
        }`}
      >
        <Icon size={big ? 26 : 20} />
      </div>
    </div>
  );
}

/** "Sample content" tag, same look as on Home: the design stand-in data is never passed off as real. */
export function SampleTag() {
  return (
    <span className="rounded-md bg-bg-fill2 px-1.5 py-0.5 font-medium text-[12px] text-text-secondary leading-4 tracking-[-0.12px]">
      Sample content
    </span>
  );
}

/**
 * Illustration for the empty and error states (Figma "No resources match", "Nothing saved yet",
 * "No results"): two stacked outlined cards in the brand colour, with a glyph on the top one.
 */
export function StateArt({ glyph }: { glyph: "saved" | "filter" | "search" | "alert" }) {
  if (glyph === "alert") {
    return (
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-error-focus text-error-text"
      >
        <AlertIcon size={24} />
      </span>
    );
  }
  const Glyph_ = glyph === "saved" ? SavedGlyph : glyph === "filter" ? FilterGlyph : SearchGlyph;
  const row = "h-1.5 rounded-full bg-primary-border/40";
  return (
    <span aria-hidden="true" className="flex w-[104px] flex-col gap-1.5">
      <span className="flex items-center gap-2 rounded-lg border border-primary-border/60 bg-primary-accent px-2 py-2 text-primary-text">
        <Glyph_ />
        <span className="flex flex-1 flex-col gap-1">
          <span className={`${row} w-full`} />
          <span className={`${row} w-2/3`} />
        </span>
      </span>
      <span className="ml-4 flex items-center gap-2 rounded-lg border border-primary-border/30 border-dashed px-2 py-2 text-primary-text/60">
        <span className="size-3 rounded-full border border-current" />
        <span className="flex flex-1 flex-col gap-1">
          <span className={`${row} w-full`} />
          <span className={`${row} w-1/2`} />
        </span>
      </span>
    </span>
  );
}

const SavedGlyph = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </svg>
);
const FilterGlyph = () => (
  <Glyph size={12} strokeWidth={2.5}>
    <path d="M3 5h18l-7 8v6l-4 2v-8Z" />
  </Glyph>
);
const SearchGlyph = () => (
  <Glyph size={12} strokeWidth={2.5}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </Glyph>
);
