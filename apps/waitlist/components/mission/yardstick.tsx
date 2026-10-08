import { cn } from "@matr/ui";
import type { CSSProperties, ReactNode } from "react";
import { asset, Badge, Container, revealDelay } from "../landing/primitives";

// Figma: Our Mission / Our Yard Stick (134:1733 light, 164:592 dark).
//
// Each illustration is drawn in Figma pixels on a 393.3px-wide frame. The frame sets
// font-size so 1em = 1 Figma px at any card width (u() converts), so the whole scene scales.
const u = (px: number) => `${px}em`;
const box = (x: number, y: number, w: number, h = w): CSSProperties => ({
  left: u(x),
  top: u(y),
  width: u(w),
  height: u(h),
});

/** Light and dark exports that differ in shape (their drop shadows extend differently). */
function ThemedArt({ name, inset, darkInset }: { name: string; inset: string; darkInset: string }) {
  return (
    <>
      <img
        decoding="async"
        loading="lazy"
        alt=""
        src={asset(`${name}.svg`)}
        className="absolute block max-w-none dark:hidden"
        style={{ inset }}
      />
      <img
        decoding="async"
        loading="lazy"
        alt=""
        src={asset(`${name}-dark.svg`)}
        className="absolute hidden max-w-none dark:block"
        style={{ inset: darkInset }}
      />
    </>
  );
}

/**
 * The mock resource card in each illustration. All three are the same 270 x 190 card in Figma,
 * drawn at different scales (s).
 */
function UiCard({
  s,
  icon,
  statIcon,
  stat,
  ellipsis,
  title,
  avatar,
  className,
  style,
}: {
  s: number;
  icon: string;
  statIcon: string;
  stat: string;
  ellipsis: string;
  title: string;
  avatar: string;
  className?: string;
  style?: CSSProperties;
}) {
  const p = (px: number) => u(px * s);
  const img = (name: string, size: number) => (
    <img
      decoding="async"
      loading="lazy"
      alt=""
      src={asset(`mission-${name}.svg`)}
      className="block shrink-0"
      style={{ width: p(size), height: p(size) }}
    />
  );
  return (
    <div
      className={cn(
        "flex flex-col bg-bg-base shadow-[0_6em_10em_rgba(36,46,71,0.1)] dark:shadow-[0_16em_12em_rgba(25,24,27,0.12)]",
        className,
      )}
      style={{
        width: p(270),
        height: p(190),
        padding: p(16),
        gap: p(10),
        borderRadius: p(12),
        ...style,
      }}
    >
      <div className="flex w-full items-center justify-between">
        <span
          className="flex shrink-0 items-center justify-center bg-primary"
          style={{ width: p(32), height: p(32), borderRadius: p(8) }}
        >
          {img(icon, 20)}
        </span>
        <span className="flex items-center" style={{ gap: p(8) }}>
          {img(statIcon, 16)}
          <span className="font-medium text-text-secondary" style={{ fontSize: p(10) }}>
            {stat}
          </span>
          {img(ellipsis, 16)}
        </span>
      </div>
      <p className="whitespace-nowrap font-semibold text-text" style={{ fontSize: p(13) }}>
        {title}
      </p>
      <div className="flex w-full flex-col" style={{ gap: p(6) }}>
        {[undefined, 180, 220].map((w) => (
          <span
            key={w ?? "full"}
            className="block bg-bg-fill2"
            style={{ width: w ? p(w) : "100%", height: p(8), borderRadius: p(4) }}
          />
        ))}
      </div>
      <span className="block w-full bg-border-soft" style={{ height: p(1) }} />
      <div className="flex items-center" style={{ gap: p(8) }}>
        <img
          decoding="async"
          loading="lazy"
          alt=""
          src={asset(`mission-${avatar}.svg`)}
          className="block shrink-0"
          style={{ width: p(24), height: p(24) }}
        />
        <span className="text-text-secondary" style={{ fontSize: p(10) }}>
          Tony Gentilcore
        </span>
      </div>
    </div>
  );
}

function CornerBadge({ icon, style }: { icon: string; style: CSSProperties }) {
  return (
    <span
      className="absolute flex items-center justify-center bg-primary-accent"
      style={{ width: u(28), height: u(28), borderRadius: u(16), ...style }}
    >
      <img
        decoding="async"
        loading="lazy"
        alt=""
        src={asset(`mission-${icon}.svg`)}
        className="block"
        style={{ width: u(20), height: u(20) }}
      />
    </span>
  );
}

/** Magnifier over the card: the lens glides across it while the feature is hovered. */
function DiscoverArt() {
  return (
    <>
      <div className="absolute" style={box(62, 102, 270, 202)}>
        <UiCard
          s={1}
          icon="layout-dashboard"
          statIcon="chart-column"
          stat="11"
          ellipsis="ellipsis-a"
          title="Understanding Design systems"
          avatar="card-avatar-a"
          className="absolute left-0"
          style={{ top: u(12) }}
        />
        <CornerBadge icon="hand-heart" style={{ left: u(247), top: 0 }} />
      </div>
      <div className="absolute inset-0 transition-[translate] duration-700 ease-smooth group-hover:-translate-x-[2.4em] group-hover:-translate-y-[1.6em]">
        <div
          className="absolute rounded-full border-text bg-[rgba(209,209,242,0.55)] shadow-[0_5.36em_16.079em_rgba(36,46,71,0.18)] backdrop-blur-[1.34px] dark:bg-info-focus dark:opacity-60 dark:shadow-none dark:backdrop-blur-[16px]"
          style={{ ...box(197, 203, 107.191), borderWidth: u(9.379), borderStyle: "solid" }}
        >
          <span
            className="absolute flex items-center justify-center bg-info-focus"
            style={{ ...box(32.31, 32.31, 34.809), borderRadius: u(4.58) }}
          >
            <span
              className="block bg-[#4a7fd4] dark:bg-[#067ff9]"
              style={{ width: u(18.321), height: u(18.321), borderRadius: u(2.748) }}
            />
          </span>
        </div>
        <div className="absolute flex items-center justify-center" style={box(281, 290, 46.425)}>
          <span
            className="block shrink-0 -rotate-45 bg-text opacity-85"
            style={{ width: u(12.059), height: u(53.595), borderRadius: u(6.029) }}
          />
        </div>
      </div>
    </>
  );
}

// [x, y, box size, rotation, piece size, light inset, dark inset, hover rotation]
const PIECES = [
  [
    "puzzle-blue",
    224.17,
    53,
    124.536,
    12,
    105,
    "-9.52% -17.14% -24.76% -17.14%",
    "-3.81% -19.05% -34.29% -19.05%",
    4,
  ],
  [
    "puzzle-peach",
    205.35,
    221,
    151.024,
    9,
    132,
    "-7.58% -13.64% -19.7% -13.64%",
    "-3.03% -15.15% -27.27% -15.15%",
    2,
  ],
  [
    "puzzle-orange",
    75,
    213.36,
    186.211,
    -12,
    157,
    "-6.37% -11.46% -16.56% -11.46%",
    "-2.55% -12.74% -22.93% -12.74%",
    -4,
  ],
] as const;

/** Tilted card with puzzle pieces; the pieces straighten up while the feature is hovered. */
function EcosystemArt() {
  return (
    <>
      <div className="absolute" style={box(62, 102, 270, 190)}>
        <div
          className="absolute flex items-center justify-center"
          style={box(-3.35, 15, 195.962, 153.778)}
        >
          <UiCard
            s={0.6543}
            icon="puzzle"
            statIcon="shapes"
            stat="11"
            ellipsis="ellipsis-b"
            title="Shape the Ecosystem"
            avatar="card-avatar-b"
            className="shrink-0 rotate-[10.26deg]"
          />
        </div>
      </div>
      {PIECES.map(([name, x, y, size, rotate, piece, inset, darkInset, hover]) => (
        <div
          key={name}
          className="absolute flex items-center justify-center"
          style={box(x, y, size)}
        >
          <div
            className="relative shrink-0 rotate-[var(--rot)] transition-[rotate,translate] duration-700 ease-smooth group-hover:rotate-[var(--hover-rot)]"
            style={
              {
                width: u(piece),
                height: u(piece),
                "--rot": `${rotate}deg`,
                "--hover-rot": `${hover}deg`,
              } as CSSProperties
            }
          >
            <ThemedArt name={`mission-${name}`} inset={inset} darkInset={darkInset} />
          </div>
        </div>
      ))}
    </>
  );
}

// [x, y, height, fill]; the orange bar is a gradient.
const BARS = [
  [0, 120, 100, "bg-info-focus"],
  [72, 56, 164, "bg-[#ffc9ad]"],
  [144, 0, 220, "bg-[linear-gradient(104.77deg,var(--color-primary)_0%,#ffc9ad_100%)]"],
] as const;

/** Card, rising arrow and bar chart; the bars grow a little while the feature is hovered. */
function GrowthArt() {
  return (
    <>
      <div className="absolute" style={box(40, 70, 256, 187.926)}>
        <UiCard
          s={0.9259}
          icon="sprout"
          statIcon="list-video"
          stat="24"
          ellipsis="ellipsis-c"
          title="Curate Your Growth"
          avatar="card-avatar-c"
          className="absolute left-0"
          style={{ top: u(12) }}
        />
        <CornerBadge icon="trending-up" style={{ left: u(228), top: 0 }} />
      </div>
      <div className="absolute" style={box(80, 90.34, 262, 217.7)}>
        <ThemedArt
          name="mission-growth-arrow"
          inset="-3.09% -4.61% -8.01% -4.61%"
          darkInset="0 -6.11% -14.7% -6.11%"
        />
      </div>
      <div className="absolute" style={box(134, 156, 202, 220)}>
        {BARS.map(([x, y, h, fill], index) => (
          <span
            key={x}
            className={cn(
              "absolute block origin-bottom shadow-[0_8em_18em_rgba(36,46,71,0.15)] transition-[scale] duration-700 ease-smooth group-hover:scale-y-[1.06] dark:shadow-[0_16em_24em_-4em_rgba(25,24,27,0.12)]",
              fill,
            )}
            style={{ ...box(x, y, 58, h), borderRadius: u(14), transitionDelay: `${index * 60}ms` }}
          />
        ))}
      </div>
    </>
  );
}

const FEATURES: {
  title: string;
  body: string;
  /** Figma frame height on the 393.3px-wide card. */
  height: number;
  background: string;
  art: ReactNode;
}[] = [
  {
    title: "Discover the Standard",
    body: "Refine your craft with highly curated learning paths, industry-standard tools, and peer-reviewed assets.",
    height: 440.654,
    background:
      "linear-gradient(138.29deg, var(--color-primary-focus) 0%, var(--color-info-focus) 100%)",
    art: <DiscoverArt />,
  },
  {
    title: "Shape the Ecosystem",
    body: "Share original files, recommend vital links, and review peer submissions to uphold our high standard of quality.",
    height: 443.134,
    background:
      "linear-gradient(221.58deg, var(--color-primary-focus) 0%, var(--color-info-focus) 99.95%)",
    art: <EcosystemArt />,
  },
  {
    title: "Curate Your Growth",
    body: "Curate playlists of essential frameworks and files, turning your personal library into a guide for others.",
    height: 440.654,
    background: "linear-gradient(to bottom, var(--color-info-focus), var(--color-primary-focus))",
    art: <GrowthArt />,
  },
];

export function Yardstick() {
  return (
    <section data-reveal="section" className="px-4 py-8">
      <Container className="flex flex-col items-center gap-[58px]">
        <div data-reveal className="flex w-full max-w-[600px] flex-col items-center gap-4">
          <Badge tone="primary">Our Yard Stick</Badge>
          <h2 className="text-center font-display font-medium text-[28px] text-text leading-9 tracking-[-0.56px] sm:text-[32px] sm:leading-10 sm:tracking-[-0.64px]">
            A community built on structural clarity and shared growth.
          </h2>
        </div>
        <div
          data-reveal
          className="grid w-full max-w-[420px] grid-cols-1 gap-12 lg:max-w-none lg:grid-cols-3 lg:gap-[30.05px]"
        >
          {FEATURES.map(({ title, body, height, background, art }, index) => (
            <article
              key={title}
              data-reveal-child
              className="group flex flex-col gap-[25.621px]"
              style={revealDelay(index * 140)}
            >
              <div
                aria-hidden
                className="relative w-full overflow-hidden rounded-2xl [container-type:inline-size]"
                style={{ aspectRatio: `393.3 / ${height}`, background }}
              >
                <div className="absolute inset-0 [font-size:calc(100cqw/393.3)]">{art}</div>
              </div>
              <div className="flex flex-col gap-[9.608px]">
                <h3 className="font-display font-semibold text-2xl text-[#080808] leading-8 tracking-[-0.24px] dark:text-text">
                  {title}
                </h3>
                <p className="text-[#888] text-base leading-7 tracking-[-0.16px] dark:text-text-secondary">
                  {body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
