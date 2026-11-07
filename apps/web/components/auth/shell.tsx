"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { startGoogleSignIn } from "../../lib/auth/api";
import { Button } from "./button";
import { GoogleIcon } from "./icons";
import { LogoMark } from "./logo-mark";

/**
 * Building blocks every auth screen shares, so create account and onboarding look the same as
 * sign in. A screen is: <AuthScreen> header (logo, optional icon tile, title, description) then
 * the form or actions as children.
 */

export type IconTone = "primary" | "success" | "warning";

const TILE_TONES: Record<IconTone, string> = {
  primary: "border-primary-focus bg-primary-accent text-primary-text",
  success: "border-success-focus bg-success-accent text-success-text",
  warning: "border-warning-focus bg-warning-accent text-warning-text",
};

/** The 56px rounded tile with an icon on the "check your inbox", "updated" and "expired" screens. */
export function IconTile({ tone, children }: { tone: IconTone; children: ReactNode }) {
  return (
    <div
      className={`flex size-14 items-center justify-center rounded-xl border ${TILE_TONES[tone]}`}
    >
      {children}
    </div>
  );
}

/**
 * Logo, optional icon tile, title and description. The title is the page's h1. With `focusTitle`
 * it takes keyboard focus on mount: use it for screens reached by a state change (inbox, updated,
 * expired) so screen reader and keyboard users land on the new content.
 */
export function AuthHeader({
  title,
  description,
  icon,
  focusTitle = false,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  focusTitle?: boolean;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle]);

  return (
    <header className="flex flex-col items-start gap-6">
      <LogoMark />
      {icon}
      <div className="flex w-full flex-col gap-2 [word-break:break-word]">
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="font-semibold text-[24px] text-text leading-8 tracking-[-0.24px] outline-none"
        >
          {title}
        </h1>
        {description ? (
          <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
            {description}
          </p>
        ) : null}
      </div>
    </header>
  );
}

/** Vertical rhythm of a screen: 24px between header, form and extras (Figma Content). */
export function AuthScreen({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}

/** "Or continue with" rule (Figma Divider row). */
export function Divider({ children = "Or continue with" }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border-soft-alpha" />
      <span className="text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
        {children}
      </span>
      <span className="h-px flex-1 bg-border-soft-alpha" />
    </div>
  );
}

/**
 * "Continue with Google". Calls /api/auth/sign-in/social and navigates to the URL it returns.
 * Reports failure through onFailure (Google sign in only works once the API has Google secrets),
 * so the screen can show its own message. `label` defaults to the sign in wording.
 */
export function GoogleButton({
  label = "Continue with Google",
  callbackURL,
  onFailure,
  disabled,
}: {
  label?: string;
  callbackURL: string;
  onFailure: () => void;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  // Navigating away leaves the button pending on purpose; a failure resets it.
  async function start() {
    setPending(true);
    const result = await startGoogleSignIn(callbackURL);
    if (!result.ok) {
      setPending(false);
      onFailure();
    }
  }
  return (
    <Button
      variant="secondary"
      icon={<GoogleIcon />}
      pending={pending}
      inactive={disabled}
      onClick={start}
    >
      {label}
    </Button>
  );
}
