import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeftIcon, SpinnerIcon } from "./icons";

/**
 * Buttons of the auth screens (Figma Button-Primary and Button-Social): 40px tall on desktop,
 * 44px on mobile for touch. `pending` shows a spinner, sets aria-busy and blocks further clicks
 * (it stays in the tab order via aria-disabled, so keyboard focus is not lost mid-request).
 */
const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border";

const BASE = `btn-lift inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg px-3 font-medium text-[14px] leading-5 tracking-[-0.14px] lg:h-10 ${FOCUS}`;

export type ButtonVariant = "primary" | "secondary";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-static-white hover:brightness-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:brightness-100",
  secondary:
    "border border-border bg-bg-elevation-1 text-text shadow-e1 hover:bg-bg-fill1 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
};

/** Class names for a button look, for links that must look like buttons. */
export function buttonClasses(variant: ButtonVariant = "primary"): string {
  return `${BASE} ${VARIANTS[variant]}`;
}

type ButtonProps = Omit<ComponentProps<"button">, "children"> & {
  variant?: ButtonVariant;
  /** A request is in flight. */
  pending?: boolean;
  /** Replaces the label while pending (for example "Signing in"). The spinner shows either way. */
  pendingLabel?: ReactNode;
  /** Dimmed and not clickable, but still focusable (for example a lockout countdown). */
  inactive?: boolean;
  /** Content before the label (an icon). */
  icon?: ReactNode;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  pending = false,
  pendingLabel,
  inactive = false,
  icon,
  children,
  className = "",
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
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
      className={`${buttonClasses(variant)} ${className}`}
    >
      {pending ? <SpinnerIcon /> : icon}
      <span className="px-0.5">{pending && pendingLabel ? pendingLabel : children}</span>
    </button>
  );
}

/** A navigation that looks like a button (for example "Continue to sign in"). */
export function ButtonLink({
  variant = "primary",
  className = "",
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...rest} className={`${buttonClasses(variant)} ${className}`} />;
}

/** Inline orange link, as in "Don't have an account? Sign up". */
export function AuthLink({ className = "", ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...rest}
      className={`rounded-sm font-medium text-primary-text hover:underline ${FOCUS} ${className}`}
    />
  );
}

/** Inline orange action that is not a navigation (for example "Resend link"). */
export function TextButton({ className = "", type = "button", ...rest }: ComponentProps<"button">) {
  return (
    <button
      {...rest}
      type={type}
      className={`rounded-sm font-medium text-primary-text hover:underline disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS} ${className}`}
    />
  );
}

/** "Back to sign in" with the arrow, as at the bottom of the forgot and reset screens. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <AuthLink href={href} className="inline-flex items-center gap-1.5 text-[14px] leading-5">
      <ArrowLeftIcon size={16} />
      {children}
    </AuthLink>
  );
}
