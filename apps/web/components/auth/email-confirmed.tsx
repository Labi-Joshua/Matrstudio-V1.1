"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { sendVerificationEmail } from "../../lib/auth/api";
import { postAuthPath } from "../../lib/auth/paths";
import {
  type ConfirmationView,
  confirmationViewFromParam,
  type ResendOutcome,
  resendOutcome,
} from "../../lib/auth/sign-up-state";
import { useMe } from "../../lib/auth/use-me";
import { normaliseEmail, validateEmail } from "../../lib/auth/validation";
import { ROUTES } from "../../lib/routes";
import { ToastRegion } from "./banner";
import { Button, ButtonLink } from "./button";
import { CheckInbox, ResendToast } from "./check-inbox";
import { TextField } from "./field";
import { CircleCheckIcon, ClockAlertIcon, LinkOffIcon, SpinnerIcon } from "./icons";
import { AuthHeader, AuthScreen, IconTile } from "./shell";
import { Turnstile, type TurnstileHandle } from "./turnstile";

/** Shown while the page loads (static export: search params are only known in the browser). */
export function EmailConfirmedFallback() {
  return (
    <AuthScreen>
      <AuthHeader title="Checking your link" />
      <p
        role="status"
        className="flex items-center gap-2 text-[14px] text-text-secondary leading-5"
      >
        <SpinnerIcon /> One moment.
      </p>
    </AuthScreen>
  );
}

/**
 * /email-confirmed: where the confirmation email link lands (Figma 9 to 12). The API redirects
 * here after GET /api/auth/verify-email, with ?error=link_expired | already_confirmed |
 * link_invalid on failure, and no error on success (the learner is signed in by then).
 */
export function EmailConfirmed() {
  const view = confirmationViewFromParam(useSearchParams().get("error"));
  switch (view) {
    case "confirmed":
      return <Confirmed />;
    case "already_confirmed":
      return <AlreadyConfirmed />;
    default:
      return <ResendLink view={view} />;
  }
}

function Confirmed() {
  const { state } = useMe();
  if (state.status === "loading") return <EmailConfirmedFallback />;
  const me = state.status === "authenticated" ? state.me : null;
  const firstName = me?.name?.trim().split(/\s+/)[0];
  return (
    <AuthScreen>
      <AuthHeader
        focusTitle
        icon={
          <IconTile tone="success">
            <CircleCheckIcon size={24} />
          </IconTile>
        }
        title="Your email is confirmed"
        description={`${firstName ? `Thanks, ${firstName}. ` : ""}Your Matr Studio account is ready. ${
          me
            ? "Continue to set up your profile and start your first learning path."
            : "Sign in to set up your profile and start your first learning path."
        }`}
      />
      <div className="flex flex-col gap-3">
        <ButtonLink href={me ? postAuthPath(me) : ROUTES.signIn}>
          {me ? "Continue" : "Sign in"}
        </ButtonLink>
        <ButtonLink href={ROUTES.home} variant="secondary">
          Back to homepage
        </ButtonLink>
      </div>
    </AuthScreen>
  );
}

function AlreadyConfirmed() {
  return (
    <AuthScreen>
      <AuthHeader
        focusTitle
        icon={
          <IconTile tone="success">
            <CircleCheckIcon size={24} />
          </IconTile>
        }
        title="You’re already confirmed"
        description="This email was confirmed earlier, so there’s nothing more to do. Sign in to pick up where you left off."
      />
      <div className="flex flex-col gap-3">
        <ButtonLink href={ROUTES.signIn}>Sign in</ButtonLink>
        <ButtonLink href={ROUTES.home} variant="secondary">
          Back to homepage
        </ButtonLink>
      </div>
    </AuthScreen>
  );
}

/**
 * Link expired (Figma 10) and link not recognised (Figma 11): the learner asks for a fresh
 * confirmation link. The design knows the email from the waitlist; here we do not, so it is
 * asked for. On success the page becomes "Check your inbox".
 */
function ResendLink({
  view,
}: {
  view: Exclude<ConfirmationView, "confirmed" | "already_confirmed">;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ResendOutcome | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  const emailInput = useRef<HTMLInputElement>(null);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (pending) return;
    const message = validateEmail(email);
    setEmailError(message);
    if (message) {
      emailInput.current?.focus();
      return;
    }
    const cleanEmail = normaliseEmail(email);
    setPending(true);
    setOutcome(null);
    const result = await sendVerificationEmail({ email: cleanEmail, captchaToken });
    if (needsCaptcha) captcha.current?.reset();
    setPending(false);
    const next = resendOutcome(result);
    if (next.kind === "sent") {
      setSentTo(cleanEmail);
      return;
    }
    setOutcome(next);
    if (next.kind === "needs_captcha") setNeedsCaptcha(true);
  }

  if (sentTo) return <CheckInbox email={sentTo} onChangeEmail={() => setSentTo(null)} />;

  const expired = view === "expired";
  return (
    <AuthScreen>
      <ToastRegion politeness="assertive">
        {outcome ? (
          <ResendToast
            outcome={outcome}
            email={email}
            onDismiss={() => setOutcome(null)}
            onRetry={() => submit()}
          />
        ) : null}
      </ToastRegion>
      <AuthHeader
        focusTitle
        icon={
          <IconTile tone={expired ? "warning" : "primary"}>
            {expired ? <ClockAlertIcon size={24} /> : <LinkOffIcon size={24} />}
          </IconTile>
        }
        title={expired ? "This link has expired" : "This link isn’t working"}
        description={
          expired
            ? "Confirmation links only work for 24 hours. Enter your email and we’ll send you a fresh one."
            : "It may have been cut off when copied, or replaced by a newer email. Enter your email and we’ll send you a fresh confirmation link."
        }
      />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          ref={emailInput}
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError(null);
          }}
          error={emailError}
          hint={
            expired
              ? undefined
              : "Got a newer email from us? Use the link in that one: only the latest link works."
          }
        />
        {needsCaptcha ? <Turnstile ref={captcha} onToken={setCaptchaToken} /> : null}
        <Button type="submit" pending={pending} pendingLabel="Sending">
          Send a new link
        </Button>
      </form>
      <ButtonLink href={ROUTES.signUp} variant="secondary">
        Use a different email
      </ButtonLink>
    </AuthScreen>
  );
}
