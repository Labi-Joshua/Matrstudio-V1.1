import { cn } from "@matr/ui";
import type { CSSProperties, ReactNode } from "react";

/** Path of an image exported from the Figma file into public/images/waitlist. */
export const asset = (name: string) => `/images/waitlist/${name}`;

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

/** Page-width container: the Figma frames are 1240px wide, centred in a 1920px canvas. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1240px]", className)}>{children}</div>;
}

export function Avatar({
  src,
  className,
  style,
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={cn("block overflow-hidden rounded-full", className)} style={style}>
      <img alt="" src={src} className="size-full object-cover" />
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
        tone === "neutral" ? "bg-bg-fill1 text-text-secondary" : "bg-primary-focus text-primary",
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
  return <img alt="" src={asset(name)} className={cn("block size-5 shrink-0", className)} />;
}
