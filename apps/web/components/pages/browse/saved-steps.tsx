import type { ReactNode } from "react";

/** Figma "Steps" (Saved 780:14382): "How saving works", three numbered cards. */
const icon = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
  className: "size-5",
} as const;

const STEPS: { title: string; text: string; icon: ReactNode }[] = [
  {
    title: "Star a path",
    text: "Not ready to start? Star it and it waits for you in Your paths.",
    icon: (
      <svg aria-hidden="true" {...icon}>
        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z" />
      </svg>
    ),
  },
  {
    title: "Bookmark a lesson",
    text: "Save a single video, article or tool to come back to later.",
    icon: (
      <svg aria-hidden="true" {...icon}>
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
      </svg>
    ),
  },
  {
    title: "Pick up again",
    text: "Open Saved and carry on from the exact lesson you left.",
    icon: (
      <svg aria-hidden="true" {...icon}>
        <circle cx="12" cy="12" r="9" />
        <path d="m10 8.5 5 3.5-5 3.5Z" />
      </svg>
    ),
  },
];

export function SavedSteps() {
  return (
    <section
      aria-labelledby="saved-steps-heading"
      className="border-border-soft border-t px-5 lg:px-8"
    >
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 border-border-soft border-r border-l px-4 py-12 md:gap-10 md:px-10 xl:py-24">
        <h2
          id="saved-steps-heading"
          className="font-medium text-[28px] text-text leading-[34px] tracking-[-0.56px] md:text-[44px] md:leading-[50px] md:tracking-[-0.88px]"
        >
          How saving works
        </h2>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="card-lift flex flex-col gap-3.5 rounded-2xl border border-border-soft p-5 md:p-7"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-[10px] bg-primary-accent text-primary-text">
                  {step.icon}
                </span>
                <span className="font-mono text-[11px] text-text-tertiary uppercase tracking-[0.66px]">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="font-semibold text-[18px] text-text leading-7 tracking-[-0.18px]">
                {step.title}
              </h3>
              <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
