import type { CSSProperties } from "react";
import type { Tile, TileFill } from "../../../lib/pages/company-tiles";
import { tileRadii } from "../../../lib/tile-shape";
import { AmbientStrip } from "../../landing/ambient-strip";

const FILL: Record<TileFill, string> = {
  key: "bg-primary",
  accent: "bg-primary-accent",
  ink: "bg-text",
  fill: "bg-bg-fill4",
};

// The design is one 24-column frame (1920px); the strip repeats it so it spans wider screens.
const COLUMNS = 24;
const SHIFTS = [0, COLUMNS, COLUMNS * 2];

function tileStyle([col, row, fill, round]: Tile, shift: number): CSSProperties {
  const style = {
    left: `calc(${col + shift} * var(--t))`,
    top: `calc(${row} * var(--t))`,
    width: "var(--t)",
    height: "var(--t)",
    "--ad": (((col + shift) * 0.15 + row * 0.35) % 6).toFixed(2),
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

/**
 * Decorative tile strip, two rows tall. --t is the tile size: 36px on the mobile frame, 80px on
 * the 1920 desktop frame, in between it follows the viewport width as the footer strip does.
 * A parent can set --tile to size the tiles itself (the showcase panel scales with its width).
 */
export function TileStrip({ tiles, className }: { tiles: readonly Tile[]; className?: string }) {
  return (
    <AmbientStrip
      className={`relative h-[calc(2*var(--t))] w-full overflow-clip [--t:var(--tile,clamp(36px,calc(100vw/24),80px))] ${className ?? ""}`}
    >
      {SHIFTS.flatMap((shift) =>
        tiles.map((tile) => (
          <span
            key={`${shift}-${tile[0]}-${tile[1]}`}
            data-fill={tile[2]}
            style={tileStyle(tile, shift)}
            className={`tile-anim tile-shape absolute ${FILL[tile[2]]}`}
          />
        )),
      )}
    </AmbientStrip>
  );
}
