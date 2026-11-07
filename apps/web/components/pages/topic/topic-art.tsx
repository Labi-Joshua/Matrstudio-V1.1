import type { CSSProperties, ReactNode } from "react";
import { type Corner, tileRadii } from "../../../lib/tile-shape";

/**
 * Art for the topic pages ("Marketing pages (V3)" in Figma). Everything is drawn from the page's
 * hue (--h on <main>, set from TOPIC_LOOK) with theme tokens and color-mix, so it follows light
 * and dark without hard-coded colours.
 */

/** Text in the topic hue, pulled towards the page text colour so it stays readable on both themes. */
export const HUE_TEXT = "text-[color-mix(in_srgb,var(--h)_70%,var(--matr-text))]";

type Fill = "accent" | "ink" | "key" | "fill";
type Round = Corner[] | "circle" | "half";
type Tile = { col: number; row: 0 | 1; fill: Fill; round?: Round };

/** Figma "Pattern" of the topic hero (780:16701): a 24-column, two-row strip of 80px tiles. */
const TILES: Tile[] = [
  { col: 0, row: 0, fill: "fill" },
  { col: 2, row: 0, fill: "fill", round: ["br"] },
  { col: 3, row: 0, fill: "key", round: ["bl"] },
  { col: 5, row: 0, fill: "key" },
  { col: 7, row: 0, fill: "key", round: ["br"] },
  { col: 8, row: 0, fill: "fill", round: "half" },
  { col: 10, row: 0, fill: "fill" },
  { col: 12, row: 0, fill: "fill", round: ["tr"] },
  { col: 13, row: 0, fill: "key", round: "half" },
  { col: 15, row: 0, fill: "key" },
  { col: 17, row: 0, fill: "key", round: ["tr"] },
  { col: 18, row: 0, fill: "fill", round: "half" },
  { col: 20, row: 0, fill: "fill", round: ["bl"] },
  { col: 22, row: 0, fill: "fill", round: ["tr"] },
  { col: 23, row: 0, fill: "key", round: "half" },

  { col: 0, row: 1, fill: "ink", round: "circle" },
  { col: 1, row: 1, fill: "fill" },
  { col: 2, row: 1, fill: "accent" },
  { col: 3, row: 1, fill: "fill", round: ["br"] },
  { col: 4, row: 1, fill: "ink", round: "half" },
  { col: 5, row: 1, fill: "fill", round: "circle" },
  { col: 6, row: 1, fill: "accent" },
  { col: 7, row: 1, fill: "fill" },
  { col: 8, row: 1, fill: "ink", round: ["tr"] },
  { col: 9, row: 1, fill: "fill", round: "half" },
  { col: 10, row: 1, fill: "accent", round: "circle" },
  { col: 11, row: 1, fill: "fill" },
  { col: 12, row: 1, fill: "ink", round: ["tl"] },
  { col: 13, row: 1, fill: "fill", round: ["tr"] },
  { col: 14, row: 1, fill: "accent", round: "half" },
  { col: 15, row: 1, fill: "fill", round: "circle" },
  { col: 16, row: 1, fill: "ink", round: ["bl"] },
  { col: 17, row: 1, fill: "fill", round: ["tl"] },
  { col: 18, row: 1, fill: "accent", round: ["tr"] },
  { col: 19, row: 1, fill: "fill", round: "half" },
  { col: 20, row: 1, fill: "ink", round: ["br"] },
  { col: 21, row: 1, fill: "fill", round: ["bl"] },
  { col: 22, row: 1, fill: "accent", round: ["tl"] },
  { col: 23, row: 1, fill: "fill", round: ["tr"] },
];

const COLUMNS = 24;
const SHIFTS = [0, COLUMNS, COLUMNS * 2];

const FILL: Record<Fill, string> = {
  accent: "bg-[color-mix(in_srgb,var(--h)_14%,var(--matr-bg-base))]",
  ink: "bg-text",
  key: "bg-(--h)",
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
    style.top = `calc(var(--tile) * ${row} + var(--tile) / 2)`;
    style.height = "calc(var(--tile) / 2)";
  }
  return style;
}

/** The strip under the hero. --tile is set on the hero section (36px on mobile, 80px at 1920). */
export function TopicPattern() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(var(--tile)*2)] overflow-clip"
    >
      {SHIFTS.map((shift) =>
        TILES.map((tile) => (
          <div
            key={`${shift}-${tile.col}-${tile.row}`}
            className={`tile-in tile-shape absolute ${FILL[tile.fill]}`}
            style={{ ...tileStyle(tile, shift), "--i": tile.col + shift } as CSSProperties}
          />
        )),
      )}
    </div>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Svg({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...stroke}>
      {children}
    </svg>
  );
}

export const CircleCheckIcon = () => (
  <Svg size={18}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="m8 12.3 2.8 2.8L16.2 9.5" />
  </Svg>
);

export const PlayIcon = () => (
  <Svg size={20}>
    <path d="M7 4.5v15l12-7.5Z" />
  </Svg>
);

export const BookmarkIcon = () => (
  <Svg size={18}>
    <path d="M6 3h12v18l-6-4.5L6 21Z" />
  </Svg>
);

export const ExternalLinkIcon = () => (
  <Svg size={18}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Svg>
);

export const BoxIcon = () => (
  <Svg size={30}>
    <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
    <path d="m3 8 9 5 9-5M12 13v8" />
  </Svg>
);

/** The 370 x 180 resource thumbnail: topic-hue cover art with a play button (video) or a box icon. */
export function ResourceThumb({ video, children }: { video: boolean; children?: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="relative h-[180px] w-full shrink-0 overflow-clip bg-[color-mix(in_srgb,var(--hc)_14%,var(--matr-bg-base))]"
    >
      <div className="absolute inset-[22.22%_-25%_-50%_53.13%] rounded-full bg-[color-mix(in_srgb,var(--hc)_26%,var(--matr-bg-base))]" />
      <div className="absolute inset-[-27.78%_71.88%_55.56%_-12.5%] rounded-full bg-[color-mix(in_srgb,var(--hc)_22%,var(--matr-bg-base))]" />
      <div className="absolute inset-[49.82%_54.43%_-6.39%_13.75%] -rotate-14 rounded-[20px] bg-[color-mix(in_srgb,var(--hc)_55%,var(--matr-bg-base))]" />
      <div className="absolute top-[14.44%] left-[66.25%] size-3.5 rounded-full bg-(--hc)" />
      <div className="absolute inset-0 bg-static-black opacity-35" />
      <div
        className={`absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-bg-base shadow-e2 ${
          video ? "size-12 rounded-full text-text" : "size-16 rounded-[18px] text-(--hc)"
        }`}
      >
        {video ? <PlayIcon /> : <BoxIcon />}
      </div>
      {children}
    </div>
  );
}
