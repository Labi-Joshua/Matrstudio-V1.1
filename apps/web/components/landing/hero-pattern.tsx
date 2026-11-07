import type { CSSProperties } from "react";
import { type Corner, tileRadii } from "../../lib/tile-shape";

/**
 * The tile strip under the hero (Figma Pattern 755:44711, 80px tiles on a 1920 frame; the mobile
 * Pattern 755:44675 is the first 12 columns of the same grid at 36px). Positions are in tile
 * units, so one list serves both: --tile is 36px on mobile and 80px from md up.
 *
 * Fills are theme tokens, so the strip re-colours itself in dark mode:
 *   accent = primary/accent, ink = text/text, key = primary/key, fill = background/bg-fill4.
 * Corners are the rounded ones (tl, tr, br, bl); "circle" and "half" are the full circle and the
 * half-height tile with a semicircle top.
 */
type Fill = "accent" | "ink" | "key" | "fill";
type Tile = {
  col: number;
  row: 0 | 1;
  fill: Fill;
  round?: Corner[] | "circle" | "half";
};

const TILES: Tile[] = [
  { col: 1, row: 0, fill: "accent", round: ["bl"] },
  { col: 3, row: 0, fill: "ink", round: ["tr"] },
  { col: 4, row: 0, fill: "key" },
  { col: 6, row: 0, fill: "key", round: ["bl"] },
  { col: 8, row: 0, fill: "key" },
  { col: 9, row: 0, fill: "accent" },
  { col: 11, row: 0, fill: "ink", round: ["bl"] },
  { col: 13, row: 0, fill: "accent" },
  { col: 14, row: 0, fill: "key" },
  { col: 16, row: 0, fill: "key", round: "half" },
  { col: 18, row: 0, fill: "key" },
  { col: 19, row: 0, fill: "ink" },
  { col: 21, row: 0, fill: "accent", round: "half" },
  { col: 23, row: 0, fill: "ink" },

  { col: 0, row: 1, fill: "fill" },
  { col: 1, row: 1, fill: "key", round: ["br"] },
  { col: 2, row: 1, fill: "fill", round: ["bl"] },
  { col: 3, row: 1, fill: "key", round: ["tl"] },
  { col: 4, row: 1, fill: "fill" },
  { col: 5, row: 1, fill: "key" },
  { col: 6, row: 1, fill: "fill", round: ["br"] },
  { col: 7, row: 1, fill: "key", round: ["bl"] },
  { col: 8, row: 1, fill: "fill", round: "circle" },
  { col: 9, row: 1, fill: "key" },
  { col: 10, row: 1, fill: "fill" },
  { col: 11, row: 1, fill: "key", round: ["br"] },
  { col: 12, row: 1, fill: "fill", round: "half" },
  { col: 13, row: 1, fill: "key", round: "circle" },
  { col: 14, row: 1, fill: "fill" },
  { col: 15, row: 1, fill: "key" },
  { col: 16, row: 1, fill: "fill", round: ["tr"] },
  { col: 17, row: 1, fill: "key", round: "half" },
  { col: 18, row: 1, fill: "fill", round: "circle" },
  { col: 19, row: 1, fill: "key" },
  { col: 20, row: 1, fill: "fill", round: ["tl"] },
  { col: 21, row: 1, fill: "key", round: ["tr"] },
  { col: 22, row: 1, fill: "fill", round: "half" },
  { col: 23, row: 1, fill: "key", round: "circle" },
];

/**
 * The design is one 24-column frame (1920px). The strip repeats it so it spans the full width of
 * the page on screens wider than that (three copies cover up to 5760px).
 */
const COLUMNS = 24;
const SHIFTS = [0, COLUMNS, COLUMNS * 2];

const FILL: Record<Fill, string> = {
  accent: "bg-primary-accent",
  ink: "bg-text",
  key: "bg-primary",
  fill: "bg-bg-fill4",
};

function tileStyle({ col, row, round }: Tile, shift: number): CSSProperties {
  const style: Record<string, string> = {
    left: `calc(var(--tile) * ${col + shift})`,
    top: `calc(var(--tile) * ${row})`,
    width: "var(--tile)",
    height: "var(--tile)",
    ...tileRadii(round, "var(--tile)", false),
  };
  if (round === "half") {
    // Half-height tile sitting on the bottom of its row, with a semicircle on top.
    style.top = `calc(var(--tile) * ${row} + var(--tile) / 2)`;
    style.height = "calc(var(--tile) / 2)";
  }
  return style;
}

export function HeroPattern() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(var(--tile)*2)] overflow-clip [--tile:clamp(36px,calc(100vw/24),80px)]"
    >
      {SHIFTS.map((shift) =>
        TILES.map((tile) => (
          <div
            key={`${shift}-${tile.col}-${tile.row}`}
            className={`tile-in tile-shape absolute ${FILL[tile.fill]}`}
            style={
              {
                ...tileStyle(tile, shift),
                "--i": tile.col + shift,
              } as CSSProperties
            }
          />
        )),
      )}
    </div>
  );
}
