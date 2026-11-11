"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { homeFor } from "../../lib/nav/menu";
import { ADMIN_ROUTES, safeNext } from "../../lib/nav/routes";
import { submitMfa } from "../../lib/session/api";
import {
  type AuthProblem,
  isBackupCode,
  isSixDigits,
  problemFrom,
} from "../../lib/session/auth-copy";
import { formatWait, retryClock } from "../../lib/session/time";
import { readNext, recalledEmail } from "../../lib/session/use-redirect";
import { Banner, StatusRegion } from "../ui/banner";
import { Button, ButtonLink, TextButton } from "../ui/button";
import { CodeInput, TextField } from "../ui/field";
import { AuthCard, AuthFooterNote, AuthHeader, InfoRow } from "./auth-frame";
import { ContactSuperAdmin } from "./sign-in-screen";

/**
 * 2-step code (Figma 4. 2-step code, 5. wrong code). POST /api/admin/sign-in/mfa {code} with the
 * pending session cookie from step 1. A backup code ("Lost your device?") is accepted by the same
 * call. A wrong code keeps the screen; too many wrong codes pause the account and end the pending
 * session, so the admin goes back to the password step.
 */
export function TwoStepScreen() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [pausedAt, setPausedAt] = useState(0);

  useEffect(() => setEmail(recalledEmail()), []);

  async function verify(value: string) {
    if (pending) return;
    const valid = backup ? isBackupCode(value) : isSixDigits(value);
    if (!valid) {
      setProblem({
        kind: "wrong",
        message: backup ? "Enter one of your backup codes." : "Enter all 6 digits of the code.",
      });
      return;
    }
    setPending(true);
    setProblem(null);
    const result = await submitMfa(value.trim());
    if (result.ok) {
      const next = readNext();
      router.replace(next ? safeNext(next) : homeFor(result.data.admin));
      return;
    }
    setPending(false);
    const found = problemFrom(result);
    if (found.kind === "paused") setPausedAt(Date.now());
    setProblem(found);
    setCode("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void verify(code);
  }

  if (problem?.kind === "paused") {
    return (
      <AuthCard>
        <AuthHeader
          focusTitle
          title="Sign-in paused"
          description={`Too many attempts on this account. You can try again in ${formatWait(problem.retryAfterSeconds)}, or ask a Super admin to unlock it.`}
        />
        <InfoRow>Try again at {retryClock(problem.retryAfterSeconds, pausedAt)}</InfoRow>
        <ButtonLink href={ADMIN_ROUTES.signIn} variant="secondary">
          Back to sign in
        </ButtonLink>
        <ContactSuperAdmin lead="Locked out?" />
      </AuthCard>
    );
  }

  const sessionLost = problem?.kind === "session";
  const fieldError = problem?.kind === "wrong" ? problem.message : null;
  return (
    <AuthCard>
      <AuthHeader
        title="Enter your 2-step code"
        description={
          backup
            ? "Enter one of the backup codes you saved when you joined. Each code works once."
            : `Open your authenticator app and enter the 6-digit code${email ? ` for ${email}` : ""}.`
        }
      />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-busy={pending}>
        <StatusRegion politeness="assertive">
          {problem && (problem.kind === "server" || problem.kind === "offline" || sessionLost) ? (
            <Banner
              tone="error"
              title={sessionLost ? "Your sign-in timed out" : "We couldn’t check the code"}
            >
              {problem.message}
            </Banner>
          ) : null}
        </StatusRegion>
        {backup ? (
          <TextField
            label="Backup code"
            name="backup-code"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="xxxxx-xxxxx"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={fieldError}
            disabled={pending}
            autoFocus
          />
        ) : (
          <CodeInput
            label="6-digit code"
            value={code}
            onChange={(v) => {
              setCode(v);
              if (problem?.kind === "wrong") setProblem(null);
            }}
            onComplete={(v) => void verify(v)}
            error={fieldError}
            disabled={pending}
            autoFocus
          />
        )}
        {sessionLost ? (
          <ButtonLink href={ADMIN_ROUTES.signIn}>Back to sign in</ButtonLink>
        ) : (
          <Button type="submit" pending={pending} pendingLabel="Checking">
            Verify
          </Button>
        )}
      </form>
      <AuthFooterNote>
        {backup ? "Have your device? " : "Lost your device? "}
        <TextButton
          onClick={() => {
            setBackup((b) => !b);
            setCode("");
            setProblem(null);
          }}
        >
          {backup ? "Use the app code" : "Use a backup code"}
        </TextButton>
      </AuthFooterNote>
    </AuthCard>
  );
}
