"use client";

import { type FormEvent, useRef, useState } from "react";
import { type ApiFailure, requestPasswordReset } from "../../lib/auth/api";
import { authErrorCopy } from "../../lib/auth/messages";
import { formatCountdown, useCountdown } from "../../lib/auth/use-countdown";
import { normaliseEmail, validateEmail } from "../../lib/auth/validation";
import { ROUTES } from "../../lib/routes";
import { Banner, ToastRegion } from "./banner";
import { BackLink, Button, buttonClasses, TextButton } from "./button";
import { TextField } from "./field";
import { MailIcon } from "./icons";
import { AuthHeader, AuthScreen, IconTile } from "./shell";
import { Turnstile, type TurnstileHandle } from "./turnstile";

/** How long "Resend link" stays disabled after a send, so it cannot be hammered. */
const RESEND_COOLDOWN_SECONDS = 30;
/** Reset links last 15 minutes (docs/SECURITY-AUTH.md section 4). */
const LINK_MINUTES = 15;

/**
 * Forgot password (Figma 5. Forgot password) and, once sent, "Check your inbox" (6. Reset link
 * sent). The sent screen never says whether an account exists: the API answers the same either way.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const cooldownLeft = useCountdown(cooldown, () => setCooldown(null));

  /** Sends the link. Returns true when the API accepted the request. */
  async function send(to: string): Promise<boolean> {
    setPending(true);
    setFailure(null);
    const result = await requestPasswordReset({ email: to, captchaToken });
    if (needsCaptcha) captcha.current?.reset();
    setPending(false);
    if (result.ok) return true;
    if (result.code === "captcha_required" || result.code === "captcha_failed") {
      setNeedsCaptcha(true);
    }
    setFailure(result);
    return false;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const message = validateEmail(email);
    setEmailError(message);
    if (message) {
      emailInput.current?.focus();
      return;
    }
    const clean = normaliseEmail(email);
    if (await send(clean)) {
      setSentTo(clean);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }

  async function resend() {
    if (!sentTo || pending || cooldown !== null) return;
    setResendNote(null);
    if (await send(sentTo)) {
      setResendNote("We sent another link.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }

  const copy = failure ? authErrorCopy(failure) : null;
  const toast = (
    <ToastRegion politeness="assertive">
      {copy ? (
        <Banner tone="error" title={copy.title} onDismiss={() => setFailure(null)}>
          {copy.description}
        </Banner>
      ) : null}
    </ToastRegion>
  );

  if (sentTo) {
    return (
      <AuthScreen>
        {toast}
        <AuthHeader
          focusTitle
          icon={
            <IconTile tone="primary">
              <MailIcon size={24} />
            </IconTile>
          }
          title="Check your inbox"
          description={`If an account exists for ${sentTo}, we’ve sent a link to reset your password. It expires in ${LINK_MINUTES} minutes.`}
        />
        <a href="mailto:" className={buttonClasses("primary")}>
          <span className="px-0.5">Open email app</span>
        </a>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          Didn’t get the email?{" "}
          <TextButton onClick={resend} aria-disabled={pending || cooldown !== null || undefined}>
            {pending
              ? "Sending…"
              : cooldown !== null
                ? `Resend link (${formatCountdown(cooldownLeft)})`
                : "Resend link"}
          </TextButton>
        </p>
        <p role="status" className="text-[13px] text-text-secondary leading-[18px]">
          {resendNote}
        </p>
        <div>
          <BackLink href={ROUTES.signIn}>Back to sign in</BackLink>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      {toast}
      <AuthHeader
        title="Forgot your password?"
        description="Enter the email you signed up with and we’ll send you a link to reset it."
      />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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
        />
        {needsCaptcha ? <Turnstile ref={captcha} onToken={setCaptchaToken} /> : null}
        <Button type="submit" pending={pending} pendingLabel="Sending link">
          Send reset link
        </Button>
      </form>
      <div>
        <BackLink href={ROUTES.signIn}>Back to sign in</BackLink>
      </div>
    </AuthScreen>
  );
}
