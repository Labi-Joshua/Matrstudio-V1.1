"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { FOCUS } from "./focus";
import { SpinnerIcon } from "./icons";

/**
 * Buttons (Figma Button-Primary: the ink button; secondary: outlined; danger: red). 40px tall,
 * 44px on phones for touch. `pending` shows a spinner, sets aria-busy and blocks further clicks
 * while staying in the tab order (aria-disabled), so focus is not lost mid-request.
 */
const BASE = `inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-3 font-medium text-[14px] leading-5 tracking-[-0.14px] transition-[filter,transform] active:scale-[0.98] motion-reduce:transition-none lg:h-10 ${FOCUS}`;

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-bg-base hover:brightness-110 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:brightness-100",
  secondary:
    "border border-border bg-bg-elevation-1 text-text shadow-e1 hover:bg-bg-fill1 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
  danger:
    "bg-error-text text-static-white hover:brightness-110 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
  ghost:
    "text-text-secondary hover:bg-bg-fill2 hover:text-text aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
};

/** Class names for a button look, for links that must look like buttons. */
export const buttonClasses = (variant: ButtonVariant = "primary", full = true): string =>
  `${BASE} ${full ? "w-full" : ""} ${VARIANTS[variant]}`;

type ButtonProps = Omit<ComponentProps<"button">, "children"> & {
  variant?: ButtonVariant;
  pending?: boolean;
  /** Replaces the label while pending (for example "Signing in"). */
  pendingLabel?: ReactNode;
  /** Dimmed and not clickable, but still focusable. */
  inactive?: boolean;
  icon?: ReactNode;
  /** Shrink to the label instead of filling the row. */
  fit?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  pending = false,
  pendingLabel,
  inactive = false,
  icon,
  fit = false,
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
      className={`${buttonClasses(variant, !fit)} ${className}`}
    >
      {pending ? <SpinnerIcon /> : icon}
      <span className="px-0.5">{pending && pendingLabel ? pendingLabel : children}</span>
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  fit = false,
  className = "",
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; fit?: boolean }) {
  return <Link {...rest} className={`${buttonClasses(variant, !fit)} ${className}`} />;
}

/** Inline orange link ("Contact a Super admin"). */
export function TextLink({ className = "", ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...rest}
      className={`rounded-sm font-medium text-primary-text hover:underline ${FOCUS} ${className}`}
    />
  );
}

/** Inline orange action that is not a navigation ("Use a backup code"). */
export function TextButton({ className = "", type = "button", ...rest }: ComponentProps<"button">) {
  return (
    <button
      {...rest}
      type={type}
      className={`rounded-sm font-medium text-primary-text hover:underline disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS} ${className}`}
    />
  );
}

/** 40px square icon button with a border (top bar, drawer). */
export const ICON_BUTTON = `flex size-10 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary hover:text-text ${FOCUS}`;
