import Link from "next/link";
import type { CSSProperties } from "react";
import { ROUTES } from "../../lib/routes";
import { HeroPattern } from "./hero-pattern";
import { HeroPointer } from "./hero-pointer";

/**
 * Figma "Product landing page · V3": Hero 742:42607 (desktop, light 742:42251) and 742:42431
 * (mobile). Cursor positions are the Figma offsets inside the rail, as a share of the rail width
 * (1240 on desktop, 390 on the 430px mobile frame) so they hold between the two frames; the mobile
 * frame shows the first four cursors only. The two lower mobile cursors are anchored to the bottom
 * of the rail (their distance from it in the frame), so they stay clear of the buttons when the
 * copy wraps onto an extra line at 390px.
 */
type Hue = "orange" | "blue" | "fuchsia" | "purple" | "emerald" | "teal";
type Cursor = {
  name: string;
  topic: string;
  hue: Hue;
  desktop: { x: number; y: number };
  mobile?: { x: number; y?: number; bottom?: number };
};

const CURSORS: Cursor[] = [
  {
    name: "Ada",
    topic: "learning UI/UX",
    hue: "orange",
    desktop: { x: 119, y: 120 },
    mobile: { x: 5, y: 14 },
  },
  {
    name: "Tobi",
    topic: "Dev handoff",
    hue: "blue",
    desktop: { x: 939, y: 96 },
    mobile: { x: 229, y: 30 },
  },
  {
    name: "Kemi",
    topic: "Brand",
    hue: "fuchsia",
    desktop: { x: 69, y: 380 },
    mobile: { x: 23, bottom: 82 },
  },
  {
    name: "Leo",
    topic: "Design systems",
    hue: "purple",
    desktop: { x: 989, y: 350 },
    mobile: { x: 199, bottom: 74 },
  },
  { name: "Maya", topic: "Product", hue: "emerald", desktop: { x: 299, y: 560 } },
  { name: "Jide", topic: "SEO", hue: "teal", desktop: { x: 819, y: 600 } },
];

const TAG_BG: Record<Hue, string> = {
  orange: "bg-utility-orange",
  blue: "bg-utility-blue",
  fuchsia: "bg-utility-fuchsia",
  purple: "bg-utility-purple",
  emerald: "bg-utility-emerald",
  teal: "bg-utility-teal",
};

const pct = (value: number, of: number) => `${((value / of) * 100).toFixed(3)}%`;

/** Each cursor wanders its own loop: three stops (offsets in px) and the loop time in seconds. */
const ROAM: Record<string, { stops: [number, number][]; seconds: number }> = {
  Ada: {
    stops: [
      [40, 22],
      [-20, 50],
      [60, -18],
    ],
    seconds: 11,
  },
  Tobi: {
    stops: [
      [-50, 30],
      [22, 60],
      [-34, -12],
    ],
    seconds: 13,
  },
  Kemi: {
    stops: [
      [36, -30],
      [70, 20],
      [-12, 40],
    ],
    seconds: 12,
  },
  Leo: {
    stops: [
      [-44, -26],
      [-14, 44],
      [26, 20],
    ],
    seconds: 14,
  },
  Maya: {
    stops: [
      [50, -20],
      [20, -50],
      [-30, -14],
    ],
    seconds: 10,
  },
  Jide: {
    stops: [
      [-40, -30],
      [-70, 12],
      [14, -36],
    ],
    seconds: 12.5,
  },
};

function CursorTag({ cursor, index }: { cursor: Cursor; index: number }) {
  const { desktop, mobile } = cursor;
  const at: { x: number; y?: number; bottom?: number } = mobile ?? desktop;
  const roam = ROAM[cursor.name] ?? {
    stops: [
      [0, 0],
      [0, 0],
      [0, 0],
    ],
    seconds: 12,
  };
  const [a, b, c] = roam.stops;
  const style = {
    "--mx": pct(at.x, mobile ? 390 : 1240),
    "--my":
      at.y !== undefined
        ? `${at.y}px`
        : `calc(${at.bottom}px + 2 * (clamp(36px, 100vw / 24, 80px) - 36px))`, // clears the taller tile strip
    "--dx": pct(desktop.x, 1240),
    "--dy": `${desktop.y}px`,
    // Each cursor pops in after the headline, then wanders on its own loop.
    "--d": `${520 + index * 130}ms`,
    "--fd": `${1400 + index * 450}ms`,
    "--rd": `${roam.seconds}s`,
    "--ax": `${a?.[0]}px`,
    "--ay": `${a?.[1]}px`,
    "--bx": `${b?.[0]}px`,
    "--by": `${b?.[1]}px`,
    "--cx": `${c?.[0]}px`,
    "--cy": `${c?.[1]}px`,
  } as CSSProperties;
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`cursor-anim pointer-events-none absolute left-(--mx) h-12 xl:top-(--dy) xl:bottom-auto xl:left-(--dx) ${
        mobile?.bottom === undefined ? "top-(--my)" : "bottom-(--my)"
      } ${mobile ? "" : "hidden xl:block"}`}
    >
      <div data-cursor="" className="cursor-drift absolute inset-0">
        <span
          className={`cursor-ring absolute top-0 left-0 -mt-4 -ml-4 size-8 rounded-full opacity-0 ${TAG_BG[cursor.hue]}`}
        />
        <span className="cursor-arrow absolute top-0 left-0 block h-[22px] w-[14.5px]">
          <img
            src={`/images/hero/cursor-${cursor.hue}.svg`}
            alt=""
            className="absolute inset-[-3.41%_-5.17%] block h-[106.82%] w-[110.34%] max-w-none"
          />
        </span>
        <span
          className={`cursor-tag absolute top-5 left-3.5 origin-top-left whitespace-nowrap rounded-tl-[3px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[12px] px-2.5 py-[5px] font-medium text-[13px] text-static-white leading-[18px] tracking-[-0.13px] ${TAG_BG[cursor.hue]}`}
        >
          {cursor.name} · {cursor.topic}
        </span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section data-hero="" className="relative overflow-clip px-5 lg:px-8">
      <HeroPointer />
      <div className="relative mx-auto flex w-full max-w-[1240px] flex-col items-center gap-6 overflow-clip border-border-soft border-r border-l px-4 pt-[88px] pb-[136px] xl:gap-9 xl:px-10 xl:pt-[168px] xl:pb-[280px] xl:overflow-visible">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-560px] left-[-421px] size-[700px] rounded-full border border-border-soft xl:top-[-1180px] xl:left-[-981px] xl:size-[1500px]"
        />

        <h1 className="flex flex-col items-center text-center font-medium text-[52px] text-text leading-[54px] tracking-[-0.02em] md:text-[88px] md:leading-[90px] xl:text-[124px] xl:leading-[124px]">
          <span className="hero-rise whitespace-nowrap">Learn design</span>
          <span className="hero-rise whitespace-nowrap" style={{ "--d": "120ms" } as CSSProperties}>
            the free way.
          </span>
        </h1>

        <p
          style={{ "--d": "260ms" } as CSSProperties}
          className="hero-rise max-w-[640px] text-center text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]"
        >
          Step-by-step paths built from the best free videos, articles and docs, for designers and
          developers who want to finish what they start.
        </p>

        <div
          style={{ "--d": "380ms" } as CSSProperties}
          className="hero-rise flex items-center gap-3"
        >
          <a
            href={ROUTES.signUp}
            className="btn-lift flex items-center justify-center rounded-lg border border-transparent bg-text px-3 py-2.5 font-medium text-[16px] text-bg-base leading-6 tracking-[-0.16px] xl:h-12 xl:px-3.5 xl:py-3"
          >
            <span className="px-0.5">Get started free</span>
          </a>
          <Link
            href={ROUTES.paths}
            className="flex items-center justify-center rounded-lg border border-border px-3 py-2.5 font-medium text-[16px] text-text hover:bg-bg-fill1 leading-6 tracking-[-0.16px] xl:h-12 xl:px-3.5 xl:py-3"
          >
            <span className="px-0.5">Explore paths</span>
          </Link>
        </div>

        {CURSORS.map((cursor, index) => (
          <CursorTag key={cursor.name} cursor={cursor} index={index} />
        ))}
      </div>
      <HeroPattern />
    </section>
  );
}
