"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { ADMIN_ROUTES } from "../../lib/nav/routes";
import { signIn } from "../../lib/session/api";
import { type AuthProblem, isEmail, problemFrom } from "../../lib/session/auth-copy";
import { formatWait, retryClock } from "../../lib/session/time";
import { readNext, rememberEmail, useRedirectIfSignedIn } from "../../lib/session/use-redirect";
import { Banner, StatusRegion } from "../ui/banner";
import { Button, TextButton } from "../ui/button";
import { PasswordField, TextField } from "../ui/field";
import { AuthCard, AuthFooterNote, AuthHeader, InfoRow } from "./auth-frame";

/** "Contact a Super admin": there is no mailbox to link, so it reveals what to do. */
export function ContactSuperAdmin({ lead }: { lead: string }) {
  const [open, setOpen] = useState(false);
  return (
    <AuthFooterNote>
      {lead}{" "}
      <TextButton aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Contact a Super admin
      </TextButton>
      {open ? (
        <p className="mt-2 text-[13px] text-text-secondary leading-[18px]">
          Any Super admin can unlock your account or send a new invite from the Admin team page. Ask
          one of them directly.
        </p>
      ) : null}
    </AuthFooterNote>
  );
}

/**
 * Sign in (Figma 1. Admin sign in, 2. wrong details, 3. paused, plus signing-in and server-error
 * states). POST /api/admin/sign-in {email, password}: 200 { status: "mfa_required" } goes on to the
 * 2-step screen; 401 invalid_credentials and 429 too_many_attempts are the other answers.
 */
export function SignInScreen() {
  useRedirectIfSignedIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pausedAt, setPausedAt] = useState<number | null>(null);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "expired")
      setNotice("You were signed out because the session ended. Sign in again to continue.");
    if (reason === "paused") setNotice("Sign-in is paused for this account for now.");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const errors: { email?: string; password?: string } = {};
    if (!isEmail(email)) errors.email = "Enter the email your invite was sent to.";
    if (!password) errors.password = "Enter your password.";
    setFieldError(errors);
    if (errors.email || errors.password) {
      document
        .querySelector<HTMLInputElement>(
          errors.email ? "input[name=email]" : "input[name=password]",
        )
        ?.focus();
      return;
    }
    setPending(true);
    setProblem(null);
    setNotice(null);
    const clean = email.trim().toLowerCase();
    const result = await signIn(clean, password);
    if (result.ok) {
      rememberEmail(clean);
      const next = readNext();
      router.push(
        next ? `${ADMIN_ROUTES.twoStep}?next=${encodeURIComponent(next)}` : ADMIN_ROUTES.twoStep,
      );
      return; // stay "pending" while the next screen loads
    }
    setPending(false);
    setPassword("");
    const found = problemFrom(result);
    if (found.kind === "paused") setPausedAt(Date.now());
    setProblem(found);
  }

  if (problem?.kind === "paused" && pausedAt !== null) {
    return (
      <AuthCard>
        <AuthHeader
          focusTitle
          title="Sign-in paused"
          description={`Too many attempts on this account. You can try again in ${formatWait(problem.retryAfterSeconds)}, or ask a Super admin to unlock it.`}
        />
        <InfoRow>Try again at {retryClock(problem.retryAfterSeconds, pausedAt)}</InfoRow>
        <Button variant="secondary" onClick={() => setProblem(null)}>
          Back to sign in
        </Button>
        <ContactSuperAdmin lead="Locked out?" />
      </AuthCard>
    );
  }

  const wrong = problem?.kind === "wrong";
  return (
    <AuthCard>
      <AuthHeader
        title="Sign in to Matr Studio Admin"
        description="For Matr Studio team members only. Use the email your invite was sent to."
      />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-busy={pending}>
        <StatusRegion politeness="assertive">
          {problem && problem.kind !== "paused" ? (
            <Banner
              tone="error"
              title={
                problem.kind === "wrong"
                  ? "That didn’t work"
                  : problem.kind === "offline"
                    ? "You’re offline"
                    : "We couldn’t sign you in"
              }
            >
              {problem.message}
            </Banner>
          ) : notice ? (
            <Banner tone="info" title={notice} />
          ) : null}
        </StatusRegion>
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError.email}
          invalid={wrong}
          disabled={pending}
          autoFocus
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError.password}
          invalid={wrong}
          disabled={pending}
        />
        <Button type="submit" pending={pending} pendingLabel="Signing in">
          Continue
        </Button>
      </form>
      <ContactSuperAdmin lead="Trouble signing in?" />
    </AuthCard>
  );
}
