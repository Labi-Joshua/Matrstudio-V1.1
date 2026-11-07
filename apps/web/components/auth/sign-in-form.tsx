"use client";

import Link from "next/link";
import { type FormEvent, useReducer, useRef, useState } from "react";
import { requestMagicLink, sendVerificationEmail, signInWithEmail } from "../../lib/auth/api";
import { authErrorCopy, formatWait } from "../../lib/auth/messages";
import { initialSignInState, type SignInNotice, signInReducer } from "../../lib/auth/sign-in-state";
import { formatCountdown, useCountdown } from "../../lib/auth/use-countdown";
import { useGoAfterSignIn, useRedirectIfAuthenticated } from "../../lib/auth/use-me";
import { normaliseEmail, validateCurrentPassword, validateEmail } from "../../lib/auth/validation";
import { ROUTES } from "../../lib/routes";
import { Banner, bannerActionClasses, ToastRegion } from "./banner";
import { AuthLink, Button, TextButton } from "./button";
import { Checkbox, PasswordField, TextField } from "./field";
import { AuthHeader, AuthScreen, Divider, GoogleButton } from "./shell";
import { Turnstile, type TurnstileHandle } from "./turnstile";

/**
 * Sign in (Figma 1. Sign in, plus its error, locked, unconfirmed, loading and can't-connect
 * states). State lives in lib/auth/sign-in-state.ts; this component wires it to the API.
 */
export function SignInForm() {
  useRedirectIfAuthenticated();
  const goAfterSignIn = useGoAfterSignIn();
  const [state, dispatch] = useReducer(signInReducer, initialSignInState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  const { notice, phase, needsCaptcha } = state;
  const busy = phase !== "idle";
  const locked = notice?.kind === "locked";
  const secondsLeft = useCountdown(locked ? notice.retryAfterSeconds : null, () =>
    dispatch({ type: "unlock" }),
  );

  /** Returns the trimmed email when valid, otherwise shows the error and focuses the field. */
  function checkEmail(): string | null {
    const message = validateEmail(email);
    setEmailError(message);
    if (message) {
      emailInput.current?.focus();
      return null;
    }
    return normaliseEmail(email);
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy || locked) return;
    const cleanEmail = checkEmail();
    const passwordMessage = validateCurrentPassword(password);
    setPasswordError(passwordMessage);
    if (!cleanEmail) return;
    if (passwordMessage) {
      passwordInput.current?.focus();
      return;
    }

    dispatch({ type: "submit" });
    const result = await signInWithEmail({
      email: cleanEmail,
      password,
      rememberMe: remember,
      captchaToken,
    });
    if (needsCaptcha) captcha.current?.reset(); // a Turnstile token is single use
    if (result.ok) {
      dispatch({ type: "succeeded" });
      await goAfterSignIn();
      return;
    }
    dispatch({ type: "failed", failure: result, email: cleanEmail });
  }

  async function sendMagicLink() {
    if (busy) return;
    const cleanEmail = checkEmail();
    if (!cleanEmail) return;
    dispatch({ type: "magic_submit" });
    const result = await requestMagicLink({
      email: cleanEmail,
      callbackURL: ROUTES.dashboard,
      captchaToken,
    });
    if (needsCaptcha) captcha.current?.reset();
    if (result.ok) dispatch({ type: "magic_sent" });
    else dispatch({ type: "failed", failure: result, email: cleanEmail });
  }

  async function resendConfirmation(to: string) {
    dispatch({ type: "resend_start" });
    const result = await sendVerificationEmail({ email: to });
    dispatch({ type: "resend_done", result });
  }

  const wrongCredentials = notice?.kind === "wrong_credentials";
  const assertive =
    notice !== null && notice.kind !== "magic_link_sent" && notice.kind !== "unverified";

  return (
    <AuthScreen>
      <ToastRegion politeness={assertive ? "assertive" : "polite"}>
        {notice ? (
          <SignInToast
            notice={notice}
            onDismiss={() => dispatch({ type: "dismiss" })}
            onResend={resendConfirmation}
            onRetry={() => submit()}
          />
        ) : null}
      </ToastRegion>

      <AuthHeader
        title="Welcome back"
        description={
          <>
            Don’t have an account? <AuthLink href={ROUTES.signUp}>Sign up</AuthLink>
          </>
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
          invalid={wrongCredentials}
        />
        <PasswordField
          ref={passwordInput}
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setPasswordError(null);
          }}
          error={passwordError}
          invalid={wrongCredentials}
        />
        <div className="flex items-center justify-between gap-4">
          <Checkbox
            label="Remember me"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <AuthLink href={ROUTES.forgotPassword} className="text-[14px] leading-5">
            Forgot password?
          </AuthLink>
        </div>

        {needsCaptcha ? <Turnstile ref={captcha} onToken={setCaptchaToken} /> : null}

        <Button
          type="submit"
          pending={phase === "submitting" || phase === "redirecting"}
          pendingLabel="Signing in"
          inactive={locked || phase === "magic_sending"}
        >
          {locked ? `Try again in ${formatCountdown(secondsLeft)}` : "Sign in"}
        </Button>
      </form>

      <Divider />
      <div className="flex flex-col items-center gap-4">
        <div className="w-full">
          <GoogleButton
            callbackURL={ROUTES.dashboard}
            disabled={busy}
            onFailure={() => dispatch({ type: "google_failed" })}
          />
        </div>
        <TextButton
          onClick={sendMagicLink}
          disabled={busy}
          className="text-[14px] leading-5"
          aria-busy={phase === "magic_sending" || undefined}
        >
          {phase === "magic_sending" ? "Sending link…" : "Email me a sign-in link instead"}
        </TextButton>
      </div>
    </AuthScreen>
  );
}

/** The toast for each notice (Figma toasts: incorrect password, too many attempts, confirm email, can't connect). */
function SignInToast({
  notice,
  onDismiss,
  onResend,
  onRetry,
}: {
  notice: SignInNotice;
  onDismiss: () => void;
  onResend: (email: string) => void;
  onRetry: () => void;
}) {
  switch (notice.kind) {
    case "wrong_credentials": {
      const copy = authErrorCopy({ ok: false, code: "INVALID_EMAIL_OR_PASSWORD", message: "" });
      return (
        <Banner tone="error" title={copy.title} onDismiss={onDismiss}>
          {copy.description}
        </Banner>
      );
    }
    case "locked":
      return (
        <Banner
          tone="warning"
          title="Too many attempts"
          onDismiss={onDismiss}
          action={
            <Link href={ROUTES.forgotPassword} className={bannerActionClasses}>
              Reset password
            </Link>
          }
        >
          Sign-in is paused for {formatWait(notice.retryAfterSeconds)} to keep your account safe.
        </Banner>
      );
    case "unverified": {
      const { resend } = notice;
      return (
        <Banner
          tone="info"
          title="Confirm your email to continue"
          onDismiss={onDismiss}
          action={
            <button
              type="button"
              className={bannerActionClasses}
              disabled={resend === "sending" || resend === "sent" || resend === "limit"}
              onClick={() => onResend(notice.email)}
            >
              {resend === "sending" ? "Sending…" : resend === "sent" ? "Sent" : "Resend email"}
            </button>
          }
        >
          {resend === "sent"
            ? `We sent a new link to ${notice.email}.`
            : resend === "limit"
              ? "You’ve reached the limit for resending. Try again later."
              : resend === "failed"
                ? "We couldn’t send it. Try again in a moment."
                : `We sent a link to ${notice.email}.`}
        </Banner>
      );
    }
    case "network": {
      const copy = authErrorCopy({ ok: false, code: "network_error", message: "" });
      return (
        <Banner
          tone="error"
          title={copy.title}
          onDismiss={onDismiss}
          action={
            <button type="button" className={bannerActionClasses} onClick={onRetry}>
              Try again
            </button>
          }
        >
          {copy.description}
        </Banner>
      );
    }
    case "captcha": {
      const copy = authErrorCopy({ ok: false, code: notice.code, message: "" });
      return (
        <Banner
          tone={notice.code === "captcha_unavailable" ? "error" : "warning"}
          title={copy.title}
          onDismiss={onDismiss}
        >
          {copy.description}
        </Banner>
      );
    }
    case "magic_link_sent":
      return (
        <Banner tone="info" title="Check your inbox" onDismiss={onDismiss}>
          If an account exists for that email, we’ve sent a link to sign in. It expires in 15
          minutes.
        </Banner>
      );
    case "google_failed":
      return (
        <Banner tone="error" title="Google sign-in isn’t available" onDismiss={onDismiss}>
          Use your email and password, or email yourself a sign-in link.
        </Banner>
      );
    case "error": {
      const copy = authErrorCopy(notice.failure);
      return (
        <Banner tone="error" title={copy.title} onDismiss={onDismiss}>
          {copy.description}
        </Banner>
      );
    }
  }
}
