import Link from "next/link";
import { ROUTES } from "../../lib/routes";

/**
 * Figma "Landing V3": Use cases 740:37734 (desktop dark), mobile 741:40873. Four cards in two rows
 * (single column below xl), each with a Copy block and a phone Visual, then the CTA pair.
 *
 * The phone visuals are exported from Figma as images (one per theme, since the app screens in them
 * follow the theme): the screens are product UI, not page content, so they stay decorative.
 */

type UseCase = {
  slug: string;
  badge: string;
  copy: string;
};

const USE_CASES: UseCase[] = [
  {
    slug: "starting-out",
    badge: "Starting out",
    copy: "You don't know where to begin. Pick a beginner path and the order is decided for you.",
  },
  {
    slug: "switching-sides",
    badge: "Switching sides",
    copy: "You write code and want to design, or the other way round. Design systems and dev handoff paths meet you halfway.",
  },
  {
    slug: "filling-one-gap",
    badge: "Filling one gap",
    copy: "You only need SEO, or just social media design. Take one path and skip the rest.",
  },
  {
    slug: "finishing",
    badge: "Finishing what you start",
    copy: "You've started five courses and finished none. Each lesson you mark done moves the bar, and the path ends when the last one does.",
  },
];

/**
 * The export is 542x320 with the phone centred. Below md the phone is drawn at 250px wide (scale
 * 0.862, height 276) in a 280px box; from md up it is the full 320px. Extra width is cropped.
 */
function Visual({ slug }: { slug: string }) {
  const imageClass =
    "absolute top-0 left-1/2 h-[276px] w-auto max-w-none -translate-x-1/2 md:h-[320px]";
  return (
    <div
      aria-hidden="true"
      className="relative h-[280px] overflow-clip rounded-2xl bg-bg-fill2 md:h-[320px]"
    >
      <img
        src={`/images/use-cases/${slug}.png`}
        alt=""
        width={542}
        height={320}
        loading="lazy"
        className={`${imageClass} dark:hidden`}
      />
      <img
        src={`/images/use-cases/${slug}-dark.png`}
        alt=""
        width={542}
        height={320}
        loading="lazy"
        className={`${imageClass} hidden dark:block`}
      />
    </div>
  );
}

export function UseCases() {
  return (
    <section
      id="use-cases"
      aria-labelledby="use-cases-heading"
      className="border-border-soft border-b px-5 py-14 md:py-20 lg:px-8 xl:py-[120px]"
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="mx-auto flex max-w-[820px] flex-col items-center gap-3 text-center">
          <h2
            id="use-cases-heading"
            className="font-medium text-[32px] text-text leading-[38px] tracking-[-0.96px] md:text-[44px] md:leading-[52px] md:tracking-[-1.32px] xl:text-[56px] xl:leading-[64px] xl:tracking-[-1.68px]"
          >
            Here's how you can use Matr Studio.
          </h2>
          <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]">
            Same library, four very different starting points.
          </p>
        </div>

        <ul className="mt-7 grid grid-cols-1 gap-7 md:mt-12 md:gap-6 xl:grid-cols-2 xl:gap-x-6 xl:gap-y-12">
          {USE_CASES.map((useCase) => (
            <li
              key={useCase.slug}
              className="card-lift mx-auto flex w-full max-w-[608px] flex-col gap-5 rounded-[20px] border border-border-soft bg-bg-base p-5 md:gap-6 md:rounded-3xl md:p-8 xl:max-w-none"
            >
              <div className="flex flex-col items-start gap-2.5">
                <h3 className="rounded-md bg-primary-focus px-1.5 py-[3px]">
                  <span className="block px-0.5 font-medium text-[13px] text-primary-text leading-[18px] tracking-[-0.13px]">
                    {useCase.badge}
                  </span>
                </h3>
                <p className="text-[16px] text-text leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]">
                  {useCase.copy}
                </p>
              </div>
              <Visual slug={useCase.slug} />
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-col items-stretch gap-3 md:mt-12 md:flex-row md:items-center md:justify-center">
          <Link
            href={ROUTES.paths}
            className="btn-lift inline-flex h-12 items-center justify-center rounded-lg border border-border bg-bg-elevation-1 px-3.5 py-3 font-medium text-[16px] text-text leading-6 tracking-[-0.16px] shadow-e1"
          >
            Explore paths
          </Link>
          <a
            href={ROUTES.signUp}
            className="btn-lift inline-flex h-12 items-center justify-center rounded-lg bg-primary px-3.5 py-3 font-medium text-[16px] text-static-white leading-6 tracking-[-0.16px]"
          >
            Get started free
          </a>
        </div>
      </div>
    </section>
  );
}
