"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { acceptInvite, signUpWithEmail } from "../../lib/auth/api";
import { authErrorCopy } from "../../lib/auth/messages";
import {
  isGoogleRegisteredParam,
  outcomeFromFailure,
  type SignUpNotice,
} from "../../lib/auth/sign-up-state";
import { useGoAfterSignIn, useRedirectIfAuthenticated } from "../../lib/auth/use-me";
import {
  normaliseEmail,
  validateEmail,
  validateFullName,
  validateNewPassword,
  validateTerms,
} from "../../lib/auth/validation";
import { ROUTES } from "../../lib/routes";
import { Banner, bannerActionClasses, ToastRegion } from "./banner";
import { AuthLink, Button } from "./button";
import { Checkbox, PasswordField, TextField } from "./field";
import { PasswordRules } from "./reset-password-form";
import { AuthHeader, AuthScreen, Divider, GoogleButton } from "./shell";
import { TURNSTILE_CONFIGURED, Turnstile, type TurnstileHandle } from "./turnstile";

/**
 * Create account (Figma 1) and its variants: from a waitlist invite (2, `inviteToken` given: no
 * email field and no Google button, the invite carries the email), field errors (3), email
 * already registered (4), loading and server error. Field messages come from lib/auth/validation.ts
 * and API failures are mapped in lib/auth/sign-up-state.ts.
 *
 * Without an invite, success calls onCreated(email): the parent shows "Check your inbox". With
 * an invite the learner is already signed in and confirmed, so we go to onboarding or the dashboard.
 */
export function CreateAccountForm({
  inviteToken,
  onCreated,
  onInviteInvalid,
}: {
  inviteToken?: string;
  onCreated?: (email: string) => void;
  onInviteInvalid?: () => void;
}) {
  const isInvite = inviteToken !== undefined;
  useRedirectIfAuthenticated();
  const goAfterSignIn = useGoAfterSignIn();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<{
    name: string | null;
    email: string | null;
    password: string | null;
    terms: string | null;
  }>({ name: null, email: null, password: null, terms: null });
  const [notice, setNotice] = useState<SignUpNotice | null>(null);
  const [pending, setPending] = useState(false);
  // These forms always need the human check, so show it from the start when it is configured
  // (the API still refuses a missing token with captcha_required, which keeps it on screen).
  const [needsCaptcha, setNeedsCaptcha] = useState(TURNSTILE_CONFIGURED);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const termsInput = useRef<HTMLInputElement>(null);

  // Coming back from Google with an email that already has an account: the API redirects here
  // with ?error=. Read once on load (no Suspense needed) and clear it from the address bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (isInvite) return;
    // The marketing closing section hands over an email with ?email=. Prefill it, then take it
    // out of the address bar so it is not left in history or shared links.
    const prefill = params.get("email")?.trim();
    if (prefill && prefill.length <= 254) setEmail(prefill);
    if (isGoogleRegisteredParam(params.get("error"))) setNotice({ kind: "google_registered" });
    if (prefill || params.has("error")) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, [isInvite]);

  function setError(field: keyof typeof errors, message: string | null) {
    setErrors((current) => ({ ...current, [field]: message }));
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (pending) return;
    const next = {
      name: validateFullName(name),
      email: isInvite ? null : validateEmail(email),
      password: validateNewPassword(password),
      terms: validateTerms(terms),
    };
    setErrors(next);
    if (next.name) return nameInput.current?.focus();
    if (next.email) return emailInput.current?.focus();
    if (next.password) return passwordInput.current?.focus();
    if (next.terms) return termsInput.current?.focus();

    setPending(true);
    setNotice(null);
    const cleanName = name.trim();
    const cleanEmail = normaliseEmail(email);
    const result = isInvite
      ? await acceptInvite({ token: inviteToken, name: cleanName, password, captchaToken })
      : await signUpWithEmail({ name: cleanName, email: cleanEmail, password, captchaToken });
    if (needsCaptcha) captcha.current?.reset(); // a Turnstile token is single use

    if (result.ok) {
      setPassword("");
      if (isInvite) {
        await goAfterSignIn(); // stays pending while the page changes
      } else {
        setPending(false);
        onCreated?.(cleanEmail);
      }
      return;
    }

    setPending(false);
    const outcome = outcomeFromFailure(result);
    if (outcome.notice?.kind === "invite_invalid" && onInviteInvalid) {
      onInviteInvalid();
      return;
    }
    setNotice(outcome.notice);
    setErrors((current) => ({
      ...current,
      email: outcome.emailError,
      password: outcome.passwordError,
    }));
    if (outcome.needsCaptcha) setNeedsCaptcha(true);
    if (outcome.emailError) emailInput.current?.focus();
    else if (outcome.passwordError) passwordInput.current?.focus();
  }

  const assertive = notice !== null && notice.kind !== "already_registered";

  return (
    <AuthScreen>
      <ToastRegion politeness={assertive ? "assertive" : "polite"}>
        {notice ? (
          <SignUpToast notice={notice} onDismiss={() => setNotice(null)} onRetry={() => submit()} />
        ) : null}
      </ToastRegion>

      <AuthHeader
        title={isInvite ? "Your spot is ready" : "Create your account"}
        description={
          isInvite ? (
            <>
              Create your account to get early access to Matr Studio. Already have an account?{" "}
              <AuthLink href={ROUTES.signIn}>Sign in</AuthLink>
            </>
          ) : (
            <>
              Already have an account? <AuthLink href={ROUTES.signIn}>Sign in</AuthLink>
            </>
          )
        }
      />

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <TextField
            ref={nameInput}
            label="Full name"
            name="name"
            autoComplete="name"
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("name", null);
            }}
            error={errors.name}
          />
          {isInvite ? null : (
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
                setError("email", null);
              }}
              error={errors.email}
            />
          )}
          <div className="flex flex-col gap-3">
            <PasswordField
              ref={passwordInput}
              label="Password"
              name="new-password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("password", null);
              }}
              error={errors.password}
            />
            <PasswordRules value={password} />
          </div>
        </div>

        <Checkbox
          ref={termsInput}
          checked={terms}
          onChange={(e) => {
            setTerms(e.target.checked);
            setError("terms", null);
          }}
          error={errors.terms}
          label={
            <>
              I agree to the{" "}
              <AuthLink href={ROUTES.terms} target="_blank" rel="noopener">
                Terms of Service
              </AuthLink>{" "}
              and{" "}
              <AuthLink href={ROUTES.privacy} target="_blank" rel="noopener">
                Privacy Policy
              </AuthLink>
            </>
          }
        />

        {needsCaptcha ? <Turnstile ref={captcha} onToken={setCaptchaToken} /> : null}

        <Button type="submit" pending={pending} pendingLabel="Creating account">
          Create account
        </Button>
      </form>

      {isInvite ? null : (
        <>
          <Divider>Or</Divider>
          <GoogleButton
            label="Sign up with Google"
            callbackURL={ROUTES.onboarding}
            disabled={pending}
            onFailure={() => setNotice({ kind: "google_failed" })}
          />
        </>
      )}
    </AuthScreen>
  );
}

/** The toast for each notice (Figma toasts: already registered, server error, rate limit, Google). */
function SignUpToast({
  notice,
  onDismiss,
  onRetry,
}: {
  notice: SignUpNotice;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const signInAction = (
    <Link href={ROUTES.signIn} className={bannerActionClasses}>
      Sign in
    </Link>
  );
  switch (notice.kind) {
    case "already_registered":
      return (
        <Banner
          tone="info"
          title="You already have an account"
          onDismiss={onDismiss}
          action={signInAction}
        >
          Sign in instead, or reset your password if you’ve forgotten it.
        </Banner>
      );
    case "google_registered":
      return (
        <Banner
          tone="info"
          title="This email already has an account"
          onDismiss={onDismiss}
          action={signInAction}
        >
          Sign in with your password once, then you can use Google next time.
        </Banner>
      );
    case "google_failed":
      return (
        <Banner tone="error" title="Google sign-up isn’t available" onDismiss={onDismiss}>
          Use your email and password to create your account.
        </Banner>
      );
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
    case "rate_limited": {
      const copy = authErrorCopy({
        ok: false,
        code: "rate_limited",
        message: "",
        ...(notice.retryAfterSeconds ? { retryAfterSeconds: notice.retryAfterSeconds } : {}),
      });
      return (
        <Banner tone="warning" title={copy.title} onDismiss={onDismiss}>
          {copy.description}
        </Banner>
      );
    }
    case "invite_invalid":
    case "server":
      return (
        <Banner tone="error" title="We couldn’t create your account" onDismiss={onDismiss}>
          Something went wrong on our side. Your details are still here, so try again in a moment.
        </Banner>
      );
  }
}
