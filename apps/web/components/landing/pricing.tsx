import Link from "next/link";
import { ROUTES } from "../../lib/routes";

/**
 * Figma "Product landing page · V3": Pricing 740:38003 (desktop, dark) and 741:41140 (mobile).
 * One free plan next to the "Why is it free?" card. The card row is stacked below lg and sits
 * side by side (1040px: plan + 420px card) from lg up.
 */
const FEATURES = [
  "Every learning path, across 7 topics",
  "Progress on every lesson",
  "Resource library search",
  "Bookmarks for paths and lessons",
  "Submit resources for review",
  "Light and dark mode",
];

function CircleCheck() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
      fill="none"
      className="size-[18px] shrink-0 text-success"
    >
      <path
        d="M6.75 9L8.25 10.5L11.25 7.5M16.5 9C16.5 13.1421 13.1421 16.5 9 16.5C4.85786 16.5 1.5 13.1421 1.5 9C1.5 4.85786 4.85786 1.5 9 1.5C13.1421 1.5 16.5 4.85786 16.5 9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="px-5 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center gap-7 border-border-soft border-r border-l py-14 md:gap-12 xl:py-[120px]">
        <div className="flex w-full flex-col items-center gap-3">
          <span className="rounded-md bg-primary-focus px-1.5 py-1 font-medium text-[14px] text-primary-text leading-5 tracking-[-0.14px]">
            <span className="px-0.5">Pricing</span>
          </span>
          <h2
            id="pricing-heading"
            className="max-w-[820px] text-center font-medium text-[32px] text-text leading-[38px] tracking-[-0.96px] md:text-[44px] md:leading-[52px] md:tracking-[-1.32px] xl:text-[56px] xl:leading-[64px] xl:tracking-[-1.68px]"
          >
            One plan. It's free.
          </h2>
          <p className="max-w-[640px] text-center text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]">
            Every path, every lesson and every resource. We link to the people who made them, so
            they keep the credit.
          </p>
        </div>

        <div className="flex w-full max-w-[640px] flex-col gap-6 lg:max-w-[1040px] lg:flex-row lg:items-start">
          <div className="card-lift flex flex-col gap-6 rounded-3xl border border-border bg-bg-base p-6 shadow-[0px_12px_16px_0px_rgba(15,15,20,0.08)] md:p-10 lg:min-w-0 lg:flex-1">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <h3 className="flex-1 font-semibold text-[18px] text-text leading-7 tracking-[-0.18px]">
                  Learner
                </h3>
                <span className="flex items-center gap-0.5 rounded-md bg-success-focus py-[3px] pr-1.5 pl-1.5 font-medium text-[13px] text-success-text leading-[18px] tracking-[-0.13px]">
                  <span
                    aria-hidden="true"
                    className="m-[3px] size-1.5 rounded-full bg-success-text"
                  />
                  <span className="px-0.5">Everyone</span>
                </span>
              </div>
              <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
                Everything Matr Studio does, for everyone who signs up.
              </p>
            </div>

            <p className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="font-semibold text-[48px] text-text leading-[52px] tracking-[-1.44px] md:text-[64px] md:leading-[68px] md:tracking-[-1.92px]">
                $0
              </span>
              <span className="text-[16px] text-text-tertiary leading-6 tracking-[-0.16px]">
                / forever
              </span>
            </p>

            <a
              href={ROUTES.signUp}
              className="btn-lift flex h-12 items-center justify-center rounded-lg bg-primary px-3.5 py-3 font-medium text-[16px] text-static-white leading-6 tracking-[-0.16px]"
            >
              <span className="px-0.5">Get started free</span>
            </a>
            <p className="text-center text-[13px] text-text-tertiary leading-5 tracking-[-0.13px]">
              No card required
            </p>

            <div aria-hidden="true" className="h-px w-full bg-border-soft" />

            <ul className="flex flex-col gap-3">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <CircleCheck />
                  <span className="min-w-0 flex-1 font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4 self-stretch rounded-3xl bg-bg-fill1 p-6 md:p-10 lg:w-[420px] lg:shrink-0">
            <div className="flex size-12 items-center justify-center rounded-xl bg-warning-accent text-warning">
              <HandHeart />
            </div>
            <h3 className="font-semibold text-[18px] text-text leading-7 tracking-[-0.18px]">
              Why is it free?
            </h3>
            <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">
              Matr Studio curates what is already free and open: video lessons, articles, docs and
              community files. We put it in order; the creators keep the views and the credit.
            </p>
            <div aria-hidden="true" className="min-h-0 flex-1 lg:min-h-8" />
            <p className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
              Want to help?
            </p>
            <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              Submit a resource that taught you something and it could be in the next path.
            </p>
            <Link
              href={ROUTES.submit}
              className="btn-lift flex items-center justify-center rounded-lg border border-border bg-bg-elevation-1 px-3 py-2.5 font-medium text-[16px] text-text leading-6 tracking-[-0.16px] shadow-e1"
            >
              <span className="px-0.5">Submit a resource</span>
            </Link>
          </div>
        </div>

        <p className="text-center text-[13px] text-text-tertiary leading-5 tracking-[-0.13px]">
          No trials, no upsells, nothing to cancel.
        </p>
      </div>
    </section>
  );
}
