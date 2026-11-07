import type { CSSProperties } from "react";
import {
  MISSION_CTA,
  MISSION_HERO,
  MISSION_PRINCIPLES,
  MISSION_SHOWCASE_ALT,
  MISSION_YARDSTICK,
  type PillarTone,
} from "../../../lib/pages/company-mission";
import { MISSION_PANEL_TILES, MISSION_TILES } from "../../../lib/pages/company-tiles";
import { ROUTES } from "../../../lib/routes";
import { FilledLink, OutlineLink } from "./page-buttons";
import { TileStrip } from "./tile-strip";

/**
 * Figma "Marketing pages (V3)": Our mission 778:7902 (desktop light 778:7903, mobile light
 * 778:8270, desktop dark 780:24338, mobile dark 780:25495). Sections: Hero, Yardstick, Principles,
 * Showcase, CTA. Mobile < md, one tablet layout between, the pixel-exact desktop from xl.
 */
const START = ROUTES.signUp;

const EYEBROW = "font-mono text-[12px] text-primary uppercase leading-[normal] tracking-[0.72px]";
const RAIL =
  "mx-auto max-w-[1240px] border-border-soft border-r border-l px-4 py-12 md:px-10 md:py-24";
const H2 =
  "font-medium text-[28px] text-text leading-[34px] tracking-[-0.56px] md:text-[36px] md:leading-[42px] md:tracking-[-0.72px] xl:text-[44px] xl:leading-[50px] xl:tracking-[-0.88px]";
const LEAD =
  "text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]";

export function MissionHero() {
  return (
    <section
      aria-labelledby="mission-hero-heading"
      className="relative overflow-clip [--t:clamp(36px,calc(100vw/24),80px)]"
    >
      <div className="px-5 lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center gap-4 border-border-soft border-r border-l px-4 pt-14 pb-[calc(2*var(--t)+48px)] text-center md:gap-6 md:px-10 md:pt-[112px] md:pb-[calc(2*var(--t)+96px)]">
          <p className="font-mono text-[11px] text-primary uppercase leading-[normal] tracking-[0.66px] md:text-[13px] md:tracking-[0.78px]">
            {MISSION_HERO.eyebrow}
          </p>
          <h1
            id="mission-hero-heading"
            className="max-w-[1000px] font-medium text-[40px] text-text leading-[46px] tracking-[-1px] md:text-[56px] md:leading-[62px] md:tracking-[-1.4px] xl:text-[72px] xl:leading-[78px] xl:tracking-[-1.8px]"
          >
            {MISSION_HERO.title}
          </h1>
          <p className={`max-w-[680px] ${LEAD}`}>{MISSION_HERO.body}</p>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <FilledLink href={START}>{MISSION_HERO.primaryCta}</FilledLink>
            <OutlineLink href={ROUTES.paths}>{MISSION_HERO.secondaryCta}</OutlineLink>
          </div>
        </div>
      </div>
      <TileStrip tiles={MISSION_TILES} className="absolute inset-x-0 bottom-0" />
    </section>
  );
}

const TONE: Record<PillarTone, { tile: string; icon: string }> = {
  primary: { tile: "bg-primary-accent", icon: "text-primary" },
  success: { tile: "bg-success-accent", icon: "text-success" },
  warning: { tile: "bg-warning-accent", icon: "text-warning" },
};

function HandHeart() {
  return (
    <svg aria-hidden="true" viewBox="0 0 22 22" fill="none" className="size-[22px]">
      <path
        d="M8.25 17.4167C8.25 18.9354 7.01878 20.1667 5.5 20.1667C3.98122 20.1667 2.75 18.9354 2.75 17.4167C2.75 15.8979 3.98122 14.6667 5.5 14.6667C7.01878 14.6667 8.25 15.8979 8.25 17.4167ZM8.25 17.4167H16.0417C16.8926 17.4167 17.7086 17.0786 18.3103 16.477C18.912 15.8753 19.25 15.0592 19.25 14.2083C19.25 13.3574 18.912 12.5414 18.3103 11.9397C17.7086 11.338 16.8926 11 16.0417 11H5.95833C5.10743 11 4.29138 10.662 3.6897 10.0603C3.08802 9.45862 2.75 8.64257 2.75 7.79167C2.75 6.94076 3.08802 6.12471 3.6897 5.52303C4.29138 4.92135 5.10743 4.58333 5.95833 4.58333H13.75M13.75 4.58333C13.75 6.10212 14.9812 7.33333 16.5 7.33333C18.0188 7.33333 19.25 6.10212 19.25 4.58333C19.25 3.06455 18.0188 1.83333 16.5 1.83333C14.9812 1.83333 13.75 3.06455 13.75 4.58333Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MissionYardstick() {
  return (
    <section
      aria-labelledby="mission-yardstick-heading"
      className="border-border-soft border-t px-5 lg:px-8"
    >
      <div className={`${RAIL} flex flex-col gap-6 md:gap-10`}>
        <p className={EYEBROW}>{MISSION_YARDSTICK.eyebrow}</p>
        <h2 id="mission-yardstick-heading" className={H2}>
          {MISSION_YARDSTICK.title}
        </h2>
        <ul className="flex flex-col gap-4 lg:flex-row">
          {MISSION_YARDSTICK.pillars.map((pillar) => (
            <li
              key={pillar.title}
              className="card-lift flex min-w-0 flex-1 flex-col items-start gap-3.5 rounded-2xl border border-border-soft p-5 md:p-8"
            >
              <span
                className={`flex size-12 items-center justify-center rounded-xl ${TONE[pillar.tone].tile} ${TONE[pillar.tone].icon}`}
              >
                <HandHeart />
              </span>
              <h3 className="font-medium text-[22px] text-text leading-7 tracking-[-0.22px] md:text-[26px] md:leading-8 md:tracking-[-0.26px]">
                {pillar.title}
              </h3>
              <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">
                {pillar.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function MissionPrinciples() {
  return (
    <section
      aria-labelledby="mission-principles-heading"
      className="border-border-soft border-t px-5 lg:px-8"
    >
      <div className={`${RAIL} flex flex-col gap-6 md:gap-10`}>
        <h2 id="mission-principles-heading" className={EYEBROW}>
          {MISSION_PRINCIPLES.eyebrow}
        </h2>
        <ul className="border-border-soft border-t">
          {MISSION_PRINCIPLES.items.map((item) => (
            <li
              key={item.title}
              className="flex flex-col gap-2 border-border-soft border-b py-5 md:flex-row md:items-center md:gap-12 md:py-8"
            >
              <h3 className="shrink-0 font-medium text-[24px] text-text leading-[30px] tracking-[-0.36px] md:w-[38%] md:text-[30px] md:leading-9 xl:w-[480px] xl:text-[36px] xl:leading-[42px] xl:tracking-[-0.54px]">
                {item.title}
              </h3>
              <p className={`min-w-0 flex-1 ${LEAD}`}>{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The app screen sits in a panel that scales with its width; tiles scale with it. */
function Screen({
  light,
  dark,
  className,
  frame,
}: {
  light: string;
  dark: string;
  className: string;
  /** Position of the screen in the panel and the shadow bleed of the export, as percentages. */
  frame: CSSProperties;
}) {
  return (
    <div className={`absolute ${className}`} style={frame}>
      <img
        src={light}
        alt={MISSION_SHOWCASE_ALT}
        loading="lazy"
        decoding="async"
        className="absolute max-w-none dark:hidden"
        style={{ left: "var(--bx)", top: "var(--by)", width: "var(--bw)" }}
      />
      <img
        src={dark}
        alt={MISSION_SHOWCASE_ALT}
        loading="lazy"
        decoding="async"
        className="absolute hidden max-w-none dark:block"
        style={{ left: "var(--bx)", top: "var(--by)", width: "var(--bw)" }}
      />
    </div>
  );
}

export function MissionShowcase() {
  return (
    <section aria-label="The Matr Studio app" className="border-border-soft border-t px-5 lg:px-8">
      <div className="mx-auto max-w-[1240px] border-border-soft border-r border-l px-4 py-12 md:px-10 md:py-24">
        <div className="relative aspect-[356/520] overflow-hidden rounded-3xl bg-bg-fill1 [--tile:calc(100cqw/9.889)] [container-type:inline-size] md:aspect-[1158/680] md:[--tile:calc(100cqw/14.475)]">
          <TileStrip tiles={MISSION_PANEL_TILES} className="absolute inset-x-0 bottom-0" />
          <Screen
            className="md:hidden"
            light="/images/pages/company/mission-app-mobile.png"
            dark="/images/pages/company/mission-app-mobile-dark.png"
            frame={
              {
                left: "13.483%",
                top: "7.692%",
                width: "73.034%",
                aspectRatio: "260 / 400",
                "--bx": "-18.462%",
                "--by": "-12%",
                "--bw": "136.923%",
              } as CSSProperties
            }
          />
          <Screen
            className="hidden md:block"
            light="/images/pages/company/mission-app.png"
            dark="/images/pages/company/mission-app-dark.png"
            frame={
              {
                left: "6.822%",
                top: "9.412%",
                width: "86.356%",
                aspectRatio: "1000 / 520",
                "--bx": "-4.8%",
                "--by": "-9.231%",
                "--bw": "109.6%",
              } as CSSProperties
            }
          />
        </div>
      </div>
    </section>
  );
}

export function MissionCta() {
  return (
    <section
      aria-labelledby="mission-cta-heading"
      className="border-border-soft border-t px-5 lg:px-8"
    >
      <div className={RAIL}>
        <div className="flex flex-col items-center gap-6 rounded-[28px] bg-bg-fill1 p-5 text-center md:p-16">
          <h2 id="mission-cta-heading" className={H2}>
            {MISSION_CTA.title}
          </h2>
          <p className={LEAD}>{MISSION_CTA.body}</p>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <FilledLink href={START}>{MISSION_CTA.primaryCta}</FilledLink>
            <OutlineLink href={ROUTES.paths}>{MISSION_CTA.secondaryCta}</OutlineLink>
          </div>
        </div>
      </div>
    </section>
  );
}
