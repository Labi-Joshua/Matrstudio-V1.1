/**
 * Corner shapes for the tile strips (hero and footer), shared so both react to hover the same way
 * as the waitlist hero mosaic: orange tiles lift and their curve swings to the opposite corner
 * (a plain square rounds into a circle), grey and pale tiles tint orange, black tiles stay put.
 * The strips set --r (resting radius) and --rh (hover radius) from these; globals.css does the rest.
 */
export type Corner = "tl" | "tr" | "br" | "bl";
export type Shape = Corner[] | "circle" | "half" | undefined;

const MIRROR: Record<Corner, Corner> = { tl: "tr", tr: "tl", br: "bl", bl: "br" };

/** border-radius value (TL TR BR BL) with the given corners rounded to a full tile. */
function corners(set: Corner[], unit: string): string {
  return (["tl", "tr", "br", "bl"] as const).map((c) => (set.includes(c) ? unit : "0")).join(" ");
}

/**
 * @param unit CSS length of one tile, e.g. "var(--tile)"
 * @param morphs whether this tile changes shape on hover (the orange "key" tiles)
 */
export function tileRadii(shape: Shape, unit: string, morphs: boolean) {
  if (shape === "half") {
    const r = `calc(${unit} / 2) calc(${unit} / 2) 0 0`;
    return { "--r": r, "--rh": r };
  }
  if (shape === "circle") {
    return { "--r": "50%", "--rh": morphs ? `calc(${unit} * 0.2)` : "50%" };
  }
  const set = shape ?? [];
  const rest = corners(set, unit);
  if (!morphs) return { "--r": rest, "--rh": rest };
  const swung =
    set.length > 0
      ? corners(
          set.map((c) => MIRROR[c]),
          unit,
        )
      : `calc(${unit} / 2)`;
  return { "--r": rest, "--rh": swung };
}
