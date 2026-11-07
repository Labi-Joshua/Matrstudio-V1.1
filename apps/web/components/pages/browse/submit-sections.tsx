import type { ReactNode } from "react";

/** "What happens after you submit" (Figma Steps 780:15595) and "What we accept" (Guidelines 780:15620). */
const icon = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
  className: "size-5",
} as const;

const STEPS: { title: string; text: string; badge: string; tone: string; icon: ReactNode }[] = [
  {
    title: "You send the link",
    text: "Paste the link, pick a topic and add a short note on why it helped you.",
    badge: "Submitted",
    tone: "bg-bg-fill1 text-text-secondary",
    icon: (
      <svg aria-hidden="true" {...icon}>
        <path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7" />
      </svg>
    ),
  },
  {
    title: "A reviewer checks it",
    text: "We make sure it’s free, working and a good fit for the topic.",
    badge: "In review",
    tone: "bg-warning-focus text-warning-text",
    icon: (
      <svg aria-hidden="true" {...icon}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    title: "It goes live",
    text: "Approved resources join the library, and we email you either way.",
    badge: "Approved",
    tone: "bg-success-focus text-success-text",
    icon: (
      <svg aria-hidden="true" {...icon}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </svg>
    ),
  },
];

const ACCEPT = [
  "Free to access, with no paywall or trial",
  "Clearly about a topic we cover",
  "Made by the creator or an official source",
  "Online and working today",
];
const REJECT = [
  "Paywalled or trial-only content",
  "Affiliate or promotional links",
  "Copies of someone else’s work",
  "Low-effort or spam content",
];

const H2 =
  "font-medium text-[28px] text-text leading-[34px] tracking-[-0.56px] md:text-[44px] md:leading-[50px] md:tracking-[-0.88px]";
const RAIL =
  "mx-auto flex max-w-[1240px] flex-col gap-6 border-border-soft border-r border-l px-4 py-12 md:gap-10 md:px-10 xl:py-24";

export function SubmitSteps() {
  return (
    <section
      aria-labelledby="submit-steps-heading"
      className="border-border-soft border-t px-5 lg:px-8"
    >
      <div className={RAIL}>
        <h2 id="submit-steps-heading" className={H2}>
          What happens after you submit
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
                <span
                  className={`rounded-md px-1.5 py-[3px] font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${step.tone}`}
                >
                  <span className="px-0.5">{step.badge}</span>
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

function Mark({ ok }: { ok: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-[18px] shrink-0 ${ok ? "text-success" : "text-error-text"}`}
    >
      {ok ? (
        <path d="M6.75 9L8.25 10.5L11.25 7.5M16.5 9C16.5 13.1421 13.1421 16.5 9 16.5C4.85786 16.5 1.5 13.1421 1.5 9C1.5 4.85786 4.85786 1.5 9 1.5C13.1421 1.5 16.5 4.85786 16.5 9Z" />
      ) : (
        <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" />
      )}
    </svg>
  );
}

function List({ title, items, ok }: { title: string; items: string[]; ok: boolean }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl bg-bg-fill1 p-5 md:p-8">
      <h3 className="font-semibold text-[18px] text-text leading-7 tracking-[-0.18px]">{title}</h3>
      <ul className="flex flex-col gap-3.5">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2.5">
            <Mark ok={ok} />
            <span className="min-w-0 flex-1 text-[16px] text-text leading-6 tracking-[-0.16px]">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SubmitGuidelines() {
  return (
    <section
      id="what-we-accept"
      aria-labelledby="what-we-accept-heading"
      className="scroll-mt-20 border-border-soft border-t px-5 lg:px-8"
    >
      <div className={RAIL}>
        <h2 id="what-we-accept-heading" className={H2}>
          What we accept
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <List title="We accept" items={ACCEPT} ok />
          <List title="We don’t accept" items={REJECT} ok={false} />
        </div>
      </div>
    </section>
  );
}
