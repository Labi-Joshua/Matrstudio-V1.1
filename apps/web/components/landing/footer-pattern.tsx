import type { CSSProperties } from "react";
import { tileRadii } from "../../lib/tile-shape";
import { AmbientStrip } from "./ambient-strip";

/**
 * The tile strip at the foot of the footer (Figma Pattern 744:13630, 80px tiles, 24 x 3 on the
 * 1920 desktop frame; mobile 744:17358 is the first 12 columns of the same grid at 36px).
 * Positions are in tile units; --t is 36px on mobile and 80px from md up. Fills are theme tokens:
 * key = primary, accent = primary-accent, ink = text, fill = bg-fill4.
 * "half" is the lower half of the cell with a semicircle top.
 */
type Fill = "key" | "accent" | "ink" | "fill";
type Corner = "tl" | "tr" | "br" | "bl";
type Round = Corner | "circle" | "half" | undefined;

const FILL: Record<Fill, string> = {
  key: "bg-primary",
  accent: "bg-primary-accent",
  ink: "bg-text",
  fill: "bg-bg-fill4",
};

// Rows of 24 cells: [fill, round]; a null cell is empty.
type Cell = [Fill, Round] | null;
const ROWS: Cell[][] = [
  [
    ["key", undefined],
    null,
    ["key", "bl"],
    ["accent", "tl"],
    null,
    ["ink", undefined],
    null,
    ["accent", "bl"],
    ["key", "circle"],
    null,
    ["key", undefined],
    null,
    ["key", "half"],
    ["ink", "circle"],
    null,
    ["accent", undefined],
    null,
    ["ink", "half"],
    ["key", "circle"],
    null,
    ["key", "tl"],
    null,
    ["key", "half"],
    ["accent", "circle"],
  ],
  [
    ["fill", undefined],
    ["key", undefined],
    ["fill", "br"],
    ["key", "bl"],
    ["fill", "circle"],
    ["key", undefined],
    ["fill", undefined],
    ["key", "br"],
    ["fill", "half"],
    ["key", "circle"],
    ["fill", undefined],
    ["key", undefined],
    ["fill", "tr"],
    ["key", "half"],
    ["fill", "circle"],
    ["key", undefined],
    ["fill", "tl"],
    ["key", "tr"],
    ["fill", "half"],
    ["key", "circle"],
    ["fill", "bl"],
    ["key", "tl"],
    ["fill", "tr"],
    ["key", "half"],
  ],
  [
    ["accent", "circle"],
    ["fill", undefined],
    ["ink", undefined],
    ["fill", "br"],
    ["accent", "half"],
    ["fill", "circle"],
    ["ink", undefined],
    ["fill", undefined],
    ["accent", "tr"],
    ["fill", "half"],
    ["ink", "circle"],
    ["fill", undefined],
    ["accent", "tl"],
    ["fill", "tr"],
    ["ink", "half"],
    ["fill", "circle"],
    ["accent", "bl"],
    ["fill", "tl"],
    ["ink", "tr"],
    ["fill", "half"],
    ["accent", "br"],
    ["fill", "bl"],
    ["ink", "tl"],
    ["fill", "tr"],
  ],
];

// The design is one 24-column frame (1920px). The strip repeats it so it spans the full width of
// the page on screens wider than that (three copies cover up to 5760px).
const COLUMNS = 24;
const SHIFTS = [0, COLUMNS, COLUMNS * 2];

function tileStyle(col: number, row: number, round: Round, fill: Fill): CSSProperties {
  const style = {
    left: `calc(${col} * var(--t))`,
    top: `calc(${row} * var(--t))`,
    width: "var(--t)",
    height: "var(--t)",
    "--ad": ((col * 0.15 + row * 0.35) % 6).toFixed(2),
    ...tileRadii(
      round === undefined ? undefined : round === "circle" || round === "half" ? round : [round],
      "var(--t)",
      fill === "key",
    ),
  } as CSSProperties;
  if (round === "half") {
    style.top = `calc(${row} * var(--t) + var(--t) / 2)`;
    style.height = "calc(var(--t) / 2)";
  }
  return style;
}

export function FooterPattern() {
  return (
    <AmbientStrip className="relative h-[calc(3*var(--t))] w-full overflow-clip [--t:clamp(36px,calc(100vw/24),80px)]">
      {SHIFTS.flatMap((shift) =>
        ROWS.flatMap((row, r) =>
          row.map((cell, c) =>
            cell ? (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed composition; the cell position is its identity
                key={`${shift}-${r}-${c}`}
                data-fill={cell[0]}
                style={tileStyle(c + shift, r, cell[1], cell[0])}
                className={`tile-anim tile-shape absolute ${FILL[cell[0]]}`}
              />
            ) : null,
          ),
        ),
      )}
    </AmbientStrip>
  );
}
