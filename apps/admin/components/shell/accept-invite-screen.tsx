"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { homeFor } from "../../lib/nav/menu";
import { ADMIN_ROUTES } from "../../lib/nav/routes";
import {
  acceptInvite,
  checkInvite,
  type Enrolment,
  enrolInvite,
  type InviteCheck,
  type InviteProblem,
} from "../../lib/session/api";
import { isSixDigits, passwordProblem, problemFrom } from "../../lib/session/auth-copy";
import { expiresIn, formatWait, retryClock, shortDateTime } from "../../lib/session/time";
import type { AdminMe } from "../../lib/session/types";
import { Banner, StatusRegion } from "../ui/banner";
import { Button, ButtonLink, TextButton } from "../ui/button";
import { CodeInput, PasswordField, TextField } from "../ui/field";
import { useSkeletonGate } from "../ui/hooks";
import { Skeleton } from "../ui/skeleton";
import { AuthCard, AuthFooterNote, AuthHeader, InfoRow } from "./auth-frame";
import { BackupCodes, QrCode, useCopy } from "./invite-parts";
import { ContactSuperAdmin } from "./sign-in-screen";

type Step =
  | { name: "checking" }
  | { name: "problem"; problem: InviteProblem }
  | { name: "password"; invite: InviteCheck }
  | { name: "setup"; invite: InviteCheck; enrolment: Enrolment }
  | { name: "codes"; admin: AdminMe; codes: string[] };

/**
 * Accept invite (Figma 6 to 9). The link carries `?token=`. GET /invite/check validates it, then:
 * 1 POST /invite/accept {token, password, name?} -> authenticator secret; 2 POST /invite/enrol
 * {token, code} -> backup codes and a signed-in session; 3 save the codes. An expired, cancelled or
 * invalid invite shows the "This invite has expired" screen.
 */
export function AcceptInviteScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ name: "checking" });
  const showSkeleton = useSkeletonGate(step.name === "checking");

  const check = useCallback(async (value: string) => {
    setStep({ name: "checking" });
    const result = await checkInvite(value);
    setStep(
      result.ok ? { name: "password", invite: result.data } : { name: "problem", problem: result },
    );
  }, []);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(value);
    if (value.length < 20) {
      setStep({
        name: "problem",
        problem: {
          code: "invite_invalid",
          message: "This invite isn’t valid.",
          invitedBy: null,
          invitedAt: null,
        },
      });
      return;
    }
    void check(value);
  }, [check]);

  if (step.name === "checking") {
    return (
      <AuthCard>
        <p role="status" aria-live="polite" className="sr-only">
          Checking your invite
        </p>
        {showSkeleton ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="h-40" />
        )}
      </AuthCard>
    );
  }
  if (step.name === "problem")
    return (
      <InviteProblemCard
        problem={step.problem}
        onRetry={token ? () => void check(token) : undefined}
      />
    );
  if (step.name === "password" && token) {
    return (
      <PasswordStep
        invite={step.invite}
        token={token}
        onDone={(enrolment) => setStep({ name: "setup", invite: step.invite, enrolment })}
        onInvalid={(problem) => setStep({ name: "problem", problem })}
      />
    );
  }
  if (step.name === "setup" && token) {
    return (
      <SetupStep
        token={token}
        enrolment={step.enrolment}
        onBack={() => void check(token)}
        onDone={(admin, codes) => setStep({ name: "codes", admin, codes })}
      />
    );
  }
  if (step.name === "codes") {
    return (
      <AuthCard>
        <AuthHeader
          focusTitle
          step="Step 2 of 2"
          title="Save your backup codes"
          description="Use one of these if you lose access to your authenticator app. Each code works once, and we won’t show them again."
        />
        <BackupCodes codes={step.codes} onDone={() => router.replace(homeFor(step.admin))} />
      </AuthCard>
    );
  }
  return null;
}

function InviteProblemCard({ problem, onRetry }: { problem: InviteProblem; onRetry?: () => void }) {
  if (
    problem.code === "network_error" ||
    problem.code === "invalid_response" ||
    (problem.status ?? 0) >= 500
  ) {
    return (
      <AuthCard>
        <AuthHeader
          focusTitle
          title="We couldn’t check your invite"
          description="Check your connection and try again."
        />
        {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
      </AuthCard>
    );
  }
  if (problem.code === "too_many_attempts") {
    const wait = problem.retryAfterSeconds ?? 900;
    return (
      <AuthCard>
        <AuthHeader
          focusTitle
          title="Too many attempts"
          description={`Try again in ${formatWait(wait)}.`}
        />
        <InfoRow>Try again at {retryClock(wait)}</InfoRow>
      </AuthCard>
    );
  }
  const cancelled = problem.code === "invite_cancelled";
  const invalid = problem.code === "invite_invalid";
  return (
    <AuthCard>
      <AuthHeader
        focusTitle
        title={
          cancelled
            ? "This invite was cancelled"
            : invalid
              ? "This invite isn’t valid"
              : "This invite has expired"
        }
        description={
          invalid
            ? "The link may be incomplete, already used, or opened with a different sign-in. Ask the person who invited you to send a new one."
            : "Admin invites last 72 hours and can be cancelled by a Super admin. Ask the person who invited you to send a new one."
        }
      />
      {problem.invitedAt ? (
        <InfoRow icon="mail">
          Invited{problem.invitedBy ? ` by ${problem.invitedBy}` : ""} on{" "}
          {shortDateTime(problem.invitedAt)}
        </InfoRow>
      ) : null}
      <ButtonLink href={ADMIN_ROUTES.signIn} variant="secondary">
        Go to sign in
      </ButtonLink>
      <ContactSuperAdmin lead="Need help?" />
    </AuthCard>
  );
}

function PasswordStep({
  invite,
  token,
  onDone,
  onInvalid,
}: {
  invite: InviteCheck;
  token: string;
  onDone: (enrolment: Enrolment) => void;
  onInvalid: (problem: InviteProblem) => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const next = {
      password: passwordProblem(password) ?? undefined,
      confirm: confirm !== password ? "The two passwords don’t match." : undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return;
    setPending(true);
    setBanner(null);
    const result = await acceptInvite(token, password, name.trim() || undefined);
    if (result.ok) {
      onDone(result.data);
      return;
    }
    setPending(false);
    if (
      result.code === "invite_invalid" ||
      result.code === "invite_expired" ||
      result.code === "invite_cancelled"
    ) {
      onInvalid({ code: result.code, message: result.message, invitedBy: null, invitedAt: null });
      return;
    }
    if (result.code.startsWith("password_")) setErrors({ password: result.message });
    else
      setBanner(
        problemFrom(result).kind === "paused"
          ? "Too many attempts. Try again later."
          : result.message,
      );
  }

  return (
    <AuthCard>
      <AuthHeader
        focusTitle
        step="Step 1 of 2"
        title="Join the Matr Studio admin team"
        description={`You’ve been invited as ${/^[aeiou]/i.test(invite.role) ? "an" : "a"} ${invite.role || "team member"}. Set a password for your admin account. It’s separate from any learner account.`}
      />
      <InfoRow>Invite expires {expiresIn(invite.expiresAt)}</InfoRow>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-busy={pending}>
        <StatusRegion politeness="assertive">
          {banner ? (
            <Banner tone="error" title="We couldn’t save your password">
              {banner}
            </Banner>
          ) : null}
        </StatusRegion>
        <TextField
          label="Email"
          value={invite.emailHint}
          readOnly
          disabled
          hint="This is the address your invite was sent to."
        />
        <TextField
          label="Your name (optional)"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          disabled={pending}
        />
        <PasswordField
          label="Create password"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="At least 12 characters, with a number and a symbol."
          disabled={pending}
        />
        <PasswordField
          label="Confirm password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
          disabled={pending}
        />
        <Button type="submit" pending={pending} pendingLabel="Saving">
          Continue
        </Button>
      </form>
    </AuthCard>
  );
}

function SetupStep({
  token,
  enrolment,
  onBack,
  onDone,
}: {
  token: string;
  enrolment: Enrolment;
  onBack: () => void;
  onDone: (admin: AdminMe, codes: string[]) => void;
}) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  async function verify(value: string) {
    if (pending) return;
    if (!isSixDigits(value)) {
      setError("Enter all 6 digits of the code.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await enrolInvite(token, value);
    if (result.ok) {
      onDone(result.data.admin, result.data.backupCodes);
      return;
    }
    setPending(false);
    setCode("");
    if (result.code === "enrolment_not_started") {
      onBack();
      return;
    }
    const problem = problemFrom(result);
    setError(
      problem.kind === "paused"
        ? `Too many attempts. Try again in ${formatWait(problem.retryAfterSeconds)}.`
        : problem.kind === "wrong" || problem.kind === "offline"
          ? problem.message
          : "Something went wrong on our side. Try again in a moment.",
    );
  }

  return (
    <AuthCard>
      <AuthHeader
        focusTitle
        step="Step 2 of 2"
        title="Set up 2-step verification"
        description="Every admin signs in with a 2-step code. Scan this QR code with an authenticator app, such as Google Authenticator or 1Password."
      />
      <div className="flex items-center gap-4">
        <QrCode value={enrolment.otpauthUri} />
        <div className="flex min-w-0 flex-col gap-1 text-[13px] text-text-secondary leading-[18px]">
          <p>Can’t scan it? Enter this key in the app instead:</p>
          <p className="break-all font-medium font-mono text-[13px] text-text">
            {enrolment.secretKey}
          </p>
          <TextButton
            className="self-start text-[13px]"
            onClick={() => void copy(enrolment.secretKey.replace(/\s+/g, ""))}
          >
            {copied ? "Copied" : "Copy key"}
          </TextButton>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void verify(code);
        }}
        noValidate
        className="flex flex-col gap-4"
        aria-busy={pending}
      >
        <CodeInput
          label="Enter the 6-digit code from the app"
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(null);
          }}
          onComplete={(v) => void verify(v)}
          error={error}
          disabled={pending}
        />
        <Button type="submit" pending={pending} pendingLabel="Checking">
          Verify and continue
        </Button>
      </form>
      <AuthFooterNote>
        Need to change your password? <TextButton onClick={onBack}>Go back</TextButton>
      </AuthFooterNote>
    </AuthCard>
  );
}
