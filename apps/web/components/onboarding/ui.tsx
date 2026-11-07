"use client";

import Link from "next/link";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";
import type { RowState } from "../../lib/auth/onboarding-steps";
import { ROUTES } from "../../lib/routes";
import { CheckIcon, SpinnerIcon } from "../auth/icons";
import { LogoMark } from "../auth/logo-mark";
import { BookOpenIcon, CircleCheckGlyph } from "./icons";

/**
 * Building blocks of the onboarding screens (Figma "Onboarding modal": a 1120 x 700 card with a
 * left pane of steps and a right pane for the question). From lg up it is the two pane card
 * centred on the page; below that it is one full screen column as in the mobile frames (logo and
 * exit link on top, the question, buttons pinned to the bottom).
 */

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border";

// ---------------------------------------------------------------------------------------------
// Buttons and links
// ---------------------------------------------------------------------------------------------

const BUTTON_BASE = `btn-lift inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-3 font-medium text-[14px] leading-5 tracking-[-0.14px] lg:h-10 ${FOCUS}`;

const BUTTON_VARIANTS = {
  /** Orange on phones, inverse (text colour on the page colour) on the card, as designed. */
  primary:
    "flex-1 bg-primary text-static-white hover:brightness-95 lg:flex-none lg:bg-text lg:text-bg-base aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:brightness-100",
  secondary:
    "border border-border-soft-alpha bg-bg-base text-text hover:bg-bg-fill1 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
  /** Borderless, for "Skip for now" sitting next to the primary button. */
  ghost: "text-text hover:bg-bg-fill1",
} as const;

type Variant = keyof typeof BUTTON_VARIANTS;

export function ObButton({
  variant = "primary",
  pending = false,
  inactive = false,
  grow = false,
  className = "",
  type = "button",
  onClick,
  children,
  ...rest
}: Omit<ComponentProps<"button">, "children"> & {
  variant?: Variant;
  /** A request is in flight: spinner, aria-busy, clicks ignored (still focusable). */
  pending?: boolean;
  /** Dimmed and not clickable but still focusable (Continue before a choice is made). */
  inactive?: boolean;
  /** Takes the free width on phones (two equal buttons). */
  grow?: boolean;
  children: ReactNode;
}) {
  const blocked = pending || inactive;
  return (
    <button
      {...rest}
      type={type}
      aria-disabled={blocked || undefined}
      aria-busy={pending || undefined}
      onClick={(event) => {
        if (blocked) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${grow ? "flex-1 lg:flex-none" : ""} ${className}`}
    >
      {pending ? <SpinnerIcon /> : null}
      <span className="px-0.5">{children}</span>
    </button>
  );
}

/** A navigation that looks like a button ("Start this path"). */
export function ObButtonLink({
  variant = "primary",
  grow = false,
  className = "",
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; grow?: boolean }) {
  return (
    <Link
      {...rest}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${grow ? "flex-1 lg:flex-none" : ""} ${className}`}
    />
  );
}

/** "Skip for now" / "Go to dashboard": the quiet link that leaves onboarding. */
export function ExitLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-sm font-medium text-[14px] text-text-secondary leading-5 tracking-[-0.14px] hover:text-text hover:underline ${FOCUS} ${className}`}
    >
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------------------------

/**
 * The screen's h1. It takes keyboard focus when it appears, so moving between steps lands screen
 * reader and keyboard users on the new question instead of leaving them on a button that is gone.
 */
export const HEADING_SIZE = "text-[20px] leading-7 tracking-[-0.2px]";
/** Phones set the question in 24px, the card in 20px (Figma mobile vs desktop frames). */
export const QUESTION_HEADING_SIZE =
  "text-[24px] leading-8 tracking-[-0.24px] lg:text-[20px] lg:leading-7 lg:tracking-[-0.2px]";

export function StepHeading({
  children,
  className = HEADING_SIZE,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1 ref={ref} tabIndex={-1} className={`font-semibold text-text outline-none ${className}`}>
      {children}
    </h1>
  );
}

/** "Step 1 of 3" (orange) plus the mobile progress bar. */
export function StepEyebrow({
  step,
  total,
  fraction,
}: {
  step: number;
  total: number;
  fraction: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium text-[13px] text-text leading-[18px] tracking-[-0.13px] lg:text-primary-text">
        Step {step} of {total}
      </p>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-bg-fill2 lg:hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------------------------

/** Where the "Help centre" and "Privacy" links open: a new tab, so nobody loses their answers' place. */
function HelpFooter() {
  const link = `${FOCUS} rounded-sm`;
  return (
    <div className="hidden h-[73px] shrink-0 items-center gap-2 border-border-soft border-t px-8 py-5 lg:flex">
      <Link
        href={ROUTES.help}
        target="_blank"
        rel="noopener"
        className={`flex items-center gap-1.5 rounded-lg bg-bg-fill1 px-2.5 py-1.5 text-[14px] text-text leading-5 tracking-[-0.14px] ${link}`}
      >
        <BookOpenIcon size={16} />
        Help centre
        <span className="sr-only"> (opens in a new tab)</span>
      </Link>
      <Link
        href={ROUTES.privacy}
        target="_blank"
        rel="noopener"
        className={`font-medium text-[14px] text-text-secondary leading-5 tracking-[-0.14px] hover:underline ${link}`}
      >
        Privacy<span className="sr-only"> (opens in a new tab)</span>
      </Link>
    </div>
  );
}

export type ModalProps = {
  /** Left pane title ("Let's set up your learning"). It is the page h1 only when `leftIsH1`. */
  leftTitle: string;
  leftDescription: string;
  leftIsH1?: boolean;
  /** The step list (or the welcome feature list). */
  leftBody: ReactNode;
  /** Phones show only one pane: the left one on the welcome screen, otherwise the right one. */
  leftOnMobile?: boolean;
  /** Link shown in the top right on phones ("Skip for now", "Go to dashboard"). */
  mobileExit?: ReactNode;
  /** Quiet link at the left of the footer from lg up. */
  footerLeft?: ReactNode;
  /** Buttons at the right of the footer. Omit for the loading screen (no footer on phones). */
  footerRight?: ReactNode;
  /** Right pane content. */
  children: ReactNode;
};

export function OnboardingModal({
  leftTitle,
  leftDescription,
  leftIsH1 = false,
  leftBody,
  leftOnMobile = false,
  mobileExit,
  footerLeft,
  footerRight,
  children,
}: ModalProps) {
  const hasFooter = Boolean(footerLeft || footerRight);
  const Title = leftIsH1 ? StepHeading : LeftTitle;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg-base lg:flex lg:items-center lg:justify-center lg:bg-bg-fill2 lg:p-6">
      <div className="mx-auto flex min-h-dvh w-full flex-col overflow-hidden bg-bg-base lg:h-[700px] lg:max-h-[calc(100dvh-3rem)] lg:min-h-0 lg:max-w-[1120px] lg:flex-row lg:rounded-3xl lg:border lg:border-border-soft lg:shadow-card">
        {/* Phones: logo and exit link. */}
        <div
          className={`flex h-[65px] shrink-0 items-center justify-between px-6 lg:hidden ${hasFooter ? "border-border-soft border-b" : ""}`}
        >
          <LogoMark />
          {mobileExit}
        </div>

        {/* Left pane */}
        <div
          className={`${leftOnMobile ? "flex flex-1" : "hidden"} min-h-0 flex-col bg-bg-base lg:flex lg:w-[42%] lg:max-w-[480px] lg:flex-none`}
        >
          <div className="hidden shrink-0 items-center border-border-soft border-b px-8 py-6 lg:flex">
            <LogoMark />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pt-6 pb-6 lg:px-8 lg:pt-7">
            <div className="flex flex-col gap-1.5 [word-break:break-word]">
              <Title>{leftTitle}</Title>
              <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
                {leftDescription}
              </p>
            </div>
            {leftBody}
          </div>
          <HelpFooter />
        </div>

        {/* Right pane */}
        <section
          className={`${leftOnMobile ? "flex-none" : "flex-1"} flex min-h-0 min-w-0 flex-col lg:flex-1 lg:border-border-soft lg:border-l lg:bg-bg-fill1`}
        >
          <div
            className={`${leftOnMobile ? "hidden" : "flex"} min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pt-6 pb-6 lg:flex lg:px-8 lg:pt-8`}
          >
            {children}
          </div>
          {hasFooter ? (
            <footer className="sticky bottom-0 flex shrink-0 items-center justify-between gap-3 border-border-soft border-t bg-bg-fill1 px-6 py-4 lg:static lg:h-[73px] lg:px-8">
              <div className="hidden lg:block">{footerLeft}</div>
              <div className="flex flex-1 items-center gap-3 lg:flex-none lg:justify-end">
                {footerRight}
              </div>
            </footer>
          ) : (
            <div
              aria-hidden="true"
              className="hidden h-[73px] shrink-0 border-border-soft border-t lg:block"
            />
          )}
        </section>
      </div>
    </div>
  );
}

function LeftTitle({ children }: { children: ReactNode }) {
  return (
    <p className="font-semibold text-[20px] text-text leading-7 tracking-[-0.2px]">{children}</p>
  );
}

// ---------------------------------------------------------------------------------------------
// The left-pane list
// ---------------------------------------------------------------------------------------------

export type StepRowView = {
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  state: RowState;
};

/** Figma "Onboarding Step Item": icon tile, title and subtitle; active adds fill and an orange bar, done a green check. */
export function StepList({ rows, label }: { rows: StepRowView[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-1">
      {rows.map((row) => (
        <li
          key={row.id}
          aria-current={row.state === "active" ? "step" : undefined}
          className={`flex items-center gap-4 rounded-xl p-3 ${row.state === "active" ? "bg-bg-fill1" : ""}`}
        >
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] border ${
              row.state === "done"
                ? "border-success-focus bg-success-accent text-success-text"
                : "border-border-soft bg-bg-base text-text-secondary"
            }`}
          >
            {row.state === "done" ? <CircleCheckGlyph size={20} /> : row.icon}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 [word-break:break-word]">
            <span className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">
              {row.title}
              {row.state === "done" ? <span className="sr-only"> (done)</span> : null}
            </span>
            <span className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              {row.subtitle}
            </span>
          </span>
          {row.state === "active" ? (
            <span aria-hidden="true" className="h-7 w-[3px] shrink-0 rounded-[2px] bg-primary" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------------------------
// Choice cards
// ---------------------------------------------------------------------------------------------

const CARD_FOCUS =
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-border";

function cardBorder(checked: boolean) {
  return checked ? "border-primary-border" : "border-border-soft-alpha hover:border-border-alpha";
}

/** The round radio mark or square checkbox mark at the end of a card. Decoration: the input is the control. */
export function ChoiceMark({ kind, checked }: { kind: "radio" | "checkbox"; checked: boolean }) {
  if (kind === "radio") {
    return (
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
          checked ? "border-primary bg-primary" : "border-border-alpha bg-bg-base"
        }`}
      >
        {checked ? <span className="size-2.5 rounded-full bg-bg-base" /> : null}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
        checked ? "border-primary bg-primary text-static-white" : "border-border-alpha bg-bg-base"
      }`}
    >
      {checked ? <CheckIcon size={16} /> : null}
    </span>
  );
}

/**
 * A big selectable card (Figma Selectable Card: icon, title, description, radio or checkbox).
 * A real radio / checkbox input sits inside the label, so the browser gives the arrow keys,
 * space bar, grouping and screen reader announcements; the card only paints the state.
 */
export function ChoiceCard({
  kind,
  name,
  value,
  checked,
  onChange,
  icon,
  title,
  description,
}: {
  kind: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-4 rounded-xl border bg-bg-base p-4 ${cardBorder(checked)} ${CARD_FOCUS}`}
    >
      <input
        type={kind}
        name={name}
        value={value}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span className="flex shrink-0 items-center rounded-xl bg-bg-fill2 p-3 text-text-secondary">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 [word-break:break-word]">
        <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
          {title}
        </span>
        <span className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          {description}
        </span>
      </span>
      <ChoiceMark kind={kind} checked={checked} />
    </label>
  );
}

export { CARD_FOCUS, cardBorder };
