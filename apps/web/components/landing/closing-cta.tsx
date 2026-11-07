import { CtaArc, Icon, type IconName } from "./closing-cta-art";

// Placeholder target for links whose page does not exist yet (see the hand-off notes).
const TODO_HREF = "#";

/**
 * Figma "Product landing page · V3": Closing CTA 740:38075 (desktop, dark) and 741:41212 (mobile).
 * The arc is a 1240 x 460 canvas scaled to 0.55 (mobile frame), 0.75 (tablet) and 1 (desktop);
 * the form, headline and chips are pinned to the bottom of the stage and, on mobile, overlap the
 * foot of the arc exactly as in the mobile frame.
 *
 * The page does not collect emails yet: the field is a visual placeholder (not focusable, hidden
 * from assistive tech) and the button is a plain link until the sign-up flow exists.
 */
const CHIPS: { icon: IconName; label: string }[] = [
  { icon: "graduationCap", label: "Learning paths" },
  { icon: "library", label: "Resource library" },
  { icon: "check", label: "Progress tracking" },
];

export function ClosingCta() {
  return (
    <section
      id="get-started"
      aria-labelledby="closing-cta-heading"
      className="overflow-x-clip px-5 lg:px-8"
    >
      <div className="mx-auto w-full max-w-[1240px] border-border-soft border-r border-l py-8">
        <div className="relative h-[539px] md:h-[660px] xl:h-[781px]">
          <div
            aria-hidden="true"
            className="absolute top-6 left-1/2 h-[460px] w-[1240px] origin-top -translate-x-1/2 scale-[0.55] md:top-7 md:scale-75 xl:top-[33.5px] xl:scale-100"
          >
            <CtaArc />
          </div>

          <div className="absolute inset-x-0 bottom-[69px] flex flex-col items-center gap-6 md:bottom-[60px] md:gap-9 xl:bottom-[49px]">
            <div className="flex w-full flex-col gap-2.5 rounded-full p-0.5 md:w-auto md:flex-row md:items-center md:gap-2">
              <div
                aria-hidden="true"
                className="flex h-10 w-full items-center rounded-full border border-border-soft bg-bg-base px-4 font-medium text-[14px] text-text-secondary leading-5 tracking-[-0.14px] md:w-[280px]"
              >
                Enter your email address
              </div>
              <a
                href={TODO_HREF}
                className="btn-lift flex items-center justify-center rounded-full bg-primary px-3 py-2.5 font-medium text-[14px] text-static-white leading-5 tracking-[-0.14px]"
              >
                <span className="px-0.5">Get started free</span>
              </a>
            </div>

            <h2
              id="closing-cta-heading"
              className="text-center font-medium text-[28px] text-text tracking-[-0.56px] md:text-[32px] md:leading-10 md:tracking-[-0.64px]"
            >
              Start your first path today.
            </h2>

            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {CHIPS.map((chip) => (
                <li
                  key={chip.label}
                  className="flex items-center gap-2 rounded-full border border-border px-4 py-2.5 transition-colors hover:border-primary-border hover:text-text font-medium text-[16px] text-text-secondary"
                >
                  <Icon name={chip.icon} />
                  {chip.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
