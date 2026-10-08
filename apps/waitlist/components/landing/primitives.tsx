import { cn } from "@matr/ui";
import type { CSSProperties, ReactNode } from "react";

/** Path of an image exported from the Figma file into public/images/waitlist. */
export const asset = (name: string) => `/images/waitlist/${name}`;

/**
 * Images whose dark-mode export (Waitlist · Dark, 66:187) differs from the light one, saved as
 * <name>-dark.<ext>. Exports that came out byte-identical were not kept.
 */
const DARK_VARIANTS = new Set([
  "arc-center-dot.svg",
  "hero-tile-professionals.svg",
  "hero-tile-projects.svg",
  "icon-circle-check.svg",
  "icon-layers.svg",
  "icon-messages-square.svg",
  "icon-moon.svg",
  "icon-palette.svg",
  "icon-shopping-cart.svg",
  "icon-sun.svg",
  "logo-nav.svg",
  "logo-wordmark.svg",
  "orbit-inner.svg",
  "orbit-outer.svg",
  "ring-inner.svg",
  "ring-track.svg",
  "toggle-switch.svg",
]);

const darkName = (name: string) => name.replace(/(\.\w+)$/, "-dark$1");

/**
 * <img> that swaps to its dark export under [data-theme="dark"]. Both are in the markup and
 * CSS picks one, so the right image shows on first paint (no flash, no client JS).
 */
export function ThemedImg({
  name,
  alt = "",
  className,
  style,
  width,
  height,
}: {
  name: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
}) {
  const props = { style, width, height };
  if (!DARK_VARIANTS.has(name)) {
    return <img decoding="async" alt={alt} src={asset(name)} className={className} {...props} />;
  }
  return (
    <>
      <img
        decoding="async"
        alt={alt}
        src={asset(name)}
        className={cn(className, "dark:hidden")}
        {...props}
      />
      <img
        decoding="async"
        alt={alt}
        src={asset(darkName(name))}
        className={cn(className, "hidden dark:block")}
        {...props}
      />
    </>
  );
}

const pct = (n: number) => `${Number((n * 100).toFixed(4))}%`;

/**
 * Positions for the decorative compositions (mosaic, arc, logo). Coordinates are the Figma
 * pixel values inside a W x H frame, returned as percentages so the composition scales
 * with its aspect-ratio container instead of overflowing on narrow screens.
 */
export function canvas(W: number, H: number) {
  return (x: number, y: number, w?: number, h?: number): CSSProperties => ({
    left: pct(x / W),
    top: pct(y / H),
    ...(w === undefined ? {} : { width: pct(w / W) }),
    ...(h === undefined ? {} : { height: pct(h / H) }),
  });
}

/** Spreads every entrance stagger out; raise to slow the whole page's choreography. */
const REVEAL_PACE = 1.4;

/** Stagger for [data-reveal] / [data-reveal-child] entrances (see globals.css). */
export function revealDelay(ms: number): CSSProperties {
  return { "--reveal-delay": `${Math.round(ms * REVEAL_PACE)}ms` } as CSSProperties;
}

/** Page-width container: the Figma frames are 1240px wide, centred in a 1920px canvas. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1240px]", className)}>{children}</div>;
}

export function Avatar({
  src,
  className,
  style,
  reveal,
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
  /** Optional [data-reveal-child] entrance (see globals.css). */
  reveal?: string;
}) {
  return (
    <span
      data-reveal-child={reveal}
      className={cn("block overflow-hidden rounded-full", className)}
      style={style}
    >
      <img decoding="async" alt="" src={src} className="size-full object-cover" />
    </span>
  );
}

export function Badge({
  children,
  dot = false,
  tone = "neutral",
}: {
  children: ReactNode;
  dot?: boolean;
  tone?: "neutral" | "primary";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1 py-0.5",
        tone === "neutral"
          ? "bg-bg-fill1 text-text-secondary"
          : "bg-primary-focus text-primary-text",
      )}
    >
      {dot && (
        <span className="flex items-center justify-center p-[3px]">
          <span className="size-1.5 rounded-[7px] bg-text-secondary" />
        </span>
      )}
      <span className="px-0.5 font-display font-medium text-xs leading-4 tracking-[-0.12px]">
        {children}
      </span>
    </span>
  );
}

/** 20px line icon exported from the Figma file. */
export function Icon({ name, className }: { name: string; className?: string }) {
  return <ThemedImg name={name} className={cn("block size-5 shrink-0", className)} />;
}

/**
 * Class for a badge inside CursorParallax; pair it with a `--depth` (px) style. Uses transform,
 * which composes with the translate/rotate/scale used by hover and entrance animations; keep
 * transform out of the element transition so CursorParallax easing is the only smoothing.
 * Lives here rather than in the "use client" module so server components get the string.
 */
export const parallax =
  "[transform:translate3d(calc(var(--mx,0)*var(--depth,12)*1px),calc(var(--my,0)*var(--depth,12)*1px),0)]";
