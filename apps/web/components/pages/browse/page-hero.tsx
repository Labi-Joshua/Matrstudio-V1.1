import type { ReactNode } from "react";
import { HeroPattern } from "../../landing/hero-pattern";

/**
 * Hero shared by the browse pages (Figma "Page · Paths" Hero 780:11779 and the sibling pages):
 * mono eyebrow, 72px headline, 18px intro, CTAs and the tile strip. Mobile stacks full-width CTAs.
 */
export function PageHero({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="relative overflow-clip px-5 lg:px-8">
      <div className="relative mx-auto flex w-full max-w-[1240px] flex-col items-center gap-4 border-border-soft border-r border-l px-4 pt-14 pb-[120px] md:gap-6 md:px-10 md:pt-20 md:pb-[168px] xl:pt-28 xl:pb-[256px]">
        <p className="font-mono text-[11px] text-primary-text uppercase tracking-[0.66px] md:text-[13px] md:tracking-[0.78px]">
          {eyebrow}
        </p>
        <h1
          id={id}
          className="max-w-[1000px] text-center font-medium text-[40px] text-text leading-[46px] tracking-[-1px] md:text-[56px] md:leading-[62px] md:tracking-[-1.4px] xl:text-[72px] xl:leading-[78px] xl:tracking-[-1.8px]"
        >
          {title}
        </h1>
        <p className="max-w-[680px] text-center text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]">
          {intro}
        </p>
        {children ? (
          <div className="flex w-full flex-col items-center gap-3 md:mt-2 md:w-auto md:flex-row">
            {children}
          </div>
        ) : null}
      </div>
      <HeroPattern />
    </section>
  );
}

const BTN =
  "btn-lift flex h-12 w-full items-center justify-center rounded-lg px-3.5 py-3 font-medium text-[16px] leading-6 tracking-[-0.16px] md:w-auto";

export const BUTTON_PRIMARY = `${BTN} bg-primary text-static-white`;
export const BUTTON_SECONDARY = `${BTN} border border-border bg-bg-elevation-1 text-text shadow-e1`;
