import type { CSSProperties } from "react";

/**
 * Figma "Showcase" (Saved 780:14330 / 780:15138, Submit 780:15652 / 780:16314): a product screen
 * sitting in a grey panel above a tile strip. The screen is a raster export of the design's
 * product mock (desktop 1000x600 and mobile 260x440 frames, each in light and dark); the tile strip
 * is rebuilt in CSS from the panel's tile geometry (approximate fills, see report).
 */
type Fill = "accent" | "ink" | "key" | "fill";
type Tile = { col: number; row: 0 | 1; fill: Fill; half?: boolean };

const TILES: Tile[] = [
  { col: 1, row: 0, fill: "fill" },
  { col: 2, row: 0, fill: "accent" },
  { col: 4, row: 0, fill: "ink" },
  { col: 6, row: 0, fill: "accent" },
  { col: 7, row: 0, fill: "fill" },
  { col: 9, row: 0, fill: "fill" },
  { col: 11, row: 0, fill: "accent" },
  { col: 12, row: 0, fill: "fill" },
  { col: 14, row: 0, fill: "accent" },
  { col: 0, row: 1, fill: "key" },
  { col: 1, row: 1, fill: "accent", half: true },
  { col: 2, row: 1, fill: "key" },
  { col: 3, row: 1, fill: "ink" },
  { col: 4, row: 1, fill: "key" },
  { col: 5, row: 1, fill: "accent" },
  { col: 6, row: 1, fill: "key", half: true },
  { col: 7, row: 1, fill: "ink" },
  { col: 8, row: 1, fill: "key" },
  { col: 9, row: 1, fill: "accent" },
  { col: 10, row: 1, fill: "key", half: true },
  { col: 11, row: 1, fill: "fill" },
  { col: 12, row: 1, fill: "key" },
  { col: 13, row: 1, fill: "accent" },
  { col: 14, row: 1, fill: "ink" },
];

const FILL: Record<Fill, string> = {
  accent: "bg-primary-accent",
  ink: "bg-text",
  key: "bg-primary",
  fill: "bg-bg-fill4",
};

export function ScreenShowcase({
  folder,
  label,
  alt,
  altMobile,
}: {
  /** Folder under /images/pages holding screen.png, screen-dark.png and the mobile pair. */
  folder: string;
  label: string;
  alt: string;
  altMobile: string;
}) {
  return (
    <section aria-label={label} className="border-border-soft border-t px-5 lg:px-8">
      <div className="mx-auto max-w-[1240px] border-border-soft border-r border-l px-4 py-12 md:px-10 xl:py-24">
        <div className="relative h-[520px] overflow-clip rounded-[20px] bg-bg-fill1 [--tile:36px] md:h-[600px] md:rounded-[28px] md:[--tile:clamp(36px,calc(100vw/24),80px)] xl:h-[680px]">
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[calc(var(--tile)*2)]">
            {TILES.map((tile) => {
              const style: CSSProperties = {
                left: `calc(var(--tile) * ${tile.col})`,
                top: tile.half
                  ? `calc(var(--tile) * ${tile.row} + var(--tile) / 2)`
                  : `calc(var(--tile) * ${tile.row})`,
                width: "var(--tile)",
                height: tile.half ? "calc(var(--tile) / 2)" : "var(--tile)",
                borderRadius: tile.half ? "999px 999px 0 0" : undefined,
              };
              return (
                <span
                  key={`${tile.col}-${tile.row}`}
                  style={style}
                  className={`absolute ${FILL[tile.fill]}`}
                />
              );
            })}
          </div>

          {/* Desktop screen */}
          <picture className="hidden md:block">
            <img
              src={`/images/pages/${folder}/screen.png`}
              alt={alt}
              width={1096}
              height={644}
              className="absolute top-[42px] left-1/2 h-auto w-[min(1096px,calc(100%-24px))] max-w-none -translate-x-1/2 dark:hidden"
            />
            <img
              src={`/images/pages/${folder}/screen-dark.png`}
              alt={alt}
              width={1096}
              height={644}
              className="absolute top-[42px] left-1/2 hidden h-auto w-[min(1096px,calc(100%-24px))] max-w-none -translate-x-1/2 dark:block"
            />
          </picture>
          {/* Mobile screen */}
          <div className="md:hidden">
            <img
              src={`/images/pages/${folder}/screen-mobile.png`}
              alt={altMobile}
              width={356}
              height={508}
              className="absolute top-1.5 left-1/2 h-auto w-[356px] max-w-none -translate-x-1/2 dark:hidden"
            />
            <img
              src={`/images/pages/${folder}/screen-mobile-dark.png`}
              alt={altMobile}
              width={356}
              height={508}
              className="absolute top-1.5 left-1/2 hidden h-auto w-[356px] max-w-none -translate-x-1/2 dark:block"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
