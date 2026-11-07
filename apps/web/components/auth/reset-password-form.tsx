"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useReducer, useRef, useState } from "react";
import { checkResetToken, resetPassword } from "../../lib/auth/api";
import { authErrorCopy } from "../../lib/auth/messages";
import { initialResetState, resetReducer } from "../../lib/auth/reset-password-state";
import {
  MESSAGES,
  passwordRules,
  validateNewPassword,
  validatePasswordConfirmation,
} from "../../lib/auth/validation";
import { ROUTES } from "../../lib/routes";
import { Banner, ToastRegion } from "./banner";
import { BackLink, Button, ButtonLink } from "./button";
import { PasswordField } from "./field";
import { CheckIcon, CircleCheckIcon, ClockAlertIcon, SpinnerIcon } from "./icons";
import { AuthHeader, AuthScreen, IconTile } from "./shell";

/**
 * The reset token arrives in the URL (/reset-password?token=...). This hook reads it once, keeps
 * it in memory only, and removes it from the address bar with history.replaceState so it does not
 * stay in the history entry, a bookmark or a shared screenshot (docs/SECURITY-AUTH.md section 4).
 * Returns undefined until the URL has been read, null when there was no token.
 */
export function useResetToken(): string | null | undefined {
  const params = useSearchParams();
  const pathname = usePathname();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const fromUrl = params.get("token");

  useEffect(() => {
    if (fromUrl) {
      setToken(fromUrl);
      window.history.replaceState(window.history.state, "", pathname);
    } else {
      setToken((current) => current ?? null);
    }
  }, [fromUrl, pathname]);

  return token;
}

/** Shown while the page loads and while the link is being checked. */
export function ResetPasswordFallback() {
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

const PASSWORD_ERROR_BY_CODE = {
  PASSWORD_COMPROMISED: MESSAGES.passwordCompromised,
  PASSWORD_TOO_SHORT: MESSAGES.passwordTooShort,
  PASSWORD_TOO_LONG: MESSAGES.passwordTooLong,
} as const;

/**
 * Set a new password (Figma 7), Password updated (8) and Reset link expired (9), driven by
 * lib/auth/reset-password-state.ts. On load the link is checked first, so an old link shows the
 * expired screen before asking for a password.
 */
export function ResetPasswordForm() {
  const token = useResetToken();
  const [state, dispatch] = useReducer(resetReducer, initialResetState);
  const [retry, setRetry] = useState(0);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retry re-runs the check on demand
  useEffect(() => {
    if (token === undefined) return;
    if (token === null) {
      dispatch({ type: "no_token" });
      return;
    }
    const controller = new AbortController();
    checkResetToken(token, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) dispatch({ type: "checked", status: result.data });
      else dispatch({ type: "check_failed", failure: result });
    });
    return () => controller.abort();
  }, [token, retry]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (state.submitting || !token) return;
    const newPasswordMessage = validateNewPassword(password);
    const confirmMessage = validatePasswordConfirmation(password, confirm);
    setPasswordError(newPasswordMessage);
    setConfirmError(newPasswordMessage ? null : confirmMessage);
    if (newPasswordMessage) {
      passwordInput.current?.focus();
      return;
    }
    if (confirmMessage) {
      confirmInput.current?.focus();
      return;
    }

    dispatch({ type: "submit" });
    const result = await resetPassword({ newPassword: password, token });
    if (result.ok) {
      setPassword("");
      setConfirm("");
      dispatch({ type: "submitted" });
      return;
    }
    const fieldMessage =
      result.code in PASSWORD_ERROR_BY_CODE
        ? PASSWORD_ERROR_BY_CODE[result.code as keyof typeof PASSWORD_ERROR_BY_CODE]
        : null;
    dispatch({ type: "submit_failed", failure: result, passwordError: fieldMessage });
    if (fieldMessage) passwordInput.current?.focus();
  }

  switch (state.view) {
    case "checking":
      return <ResetPasswordFallback />;

    case "expired":
    case "invalid":
      return (
        <AuthScreen>
          <AuthHeader
            focusTitle
            icon={
              <IconTile tone="warning">
                <ClockAlertIcon size={24} />
              </IconTile>
            }
            title={
              state.view === "expired"
                ? "This reset link has expired"
                : "This reset link isn’t valid"
            }
            description={
              state.view === "expired"
                ? "Reset links are valid for 15 minutes and can only be used once. Request a new link to continue."
                : "The link may be incomplete or already used. Request a new link to continue."
            }
          />
          <ButtonLink href={ROUTES.forgotPassword}>Request a new link</ButtonLink>
          <div>
            <BackLink href={ROUTES.signIn}>Back to sign in</BackLink>
          </div>
        </AuthScreen>
      );

    case "offline": {
      const copy = authErrorCopy({ ok: false, code: "network_error", message: "" });
      return (
        <AuthScreen>
          <AuthHeader focusTitle title={copy.title} description={copy.description} />
          <Button
            onClick={() => {
              dispatch({ type: "retry_check" });
              setRetry((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </AuthScreen>
      );
    }

    case "updated":
      return (
        <AuthScreen>
          <AuthHeader
            focusTitle
            icon={
              <IconTile tone="success">
                <CircleCheckIcon size={24} />
              </IconTile>
            }
            title="Password updated"
            description="Your password has been changed. Sign in with your new password to continue."
          />
          <ButtonLink href={ROUTES.signIn}>Continue to sign in</ButtonLink>
        </AuthScreen>
      );

    case "form": {
      const failureCopy = state.failure ? authErrorCopy(state.failure) : null;
      return (
        <AuthScreen>
          <ToastRegion politeness="assertive">
            {failureCopy ? (
              <Banner
                tone="error"
                title={failureCopy.title}
                onDismiss={() => dispatch({ type: "dismiss" })}
              >
                {failureCopy.description}
              </Banner>
            ) : null}
          </ToastRegion>
          <AuthHeader
            title="Set a new password"
            description="Choose a strong password you haven’t used on Matr Studio before."
          />
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <PasswordField
                ref={passwordInput}
                label="New password"
                name="new-password"
                autoComplete="new-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                error={passwordError ?? state.passwordError}
              />
              <PasswordRules value={password} />
            </div>
            <PasswordField
              ref={confirmInput}
              label="Confirm password"
              name="confirm-password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setConfirmError(null);
              }}
              error={confirmError}
            />
            <Button type="submit" pending={state.submitting} pendingLabel="Updating password">
              Update password
            </Button>
          </form>
        </AuthScreen>
      );
    }
  }
}

/** "Your password must contain" checklist (Figma), driven by passwordRules() in validation.ts. */
export function PasswordRules({ value }: { value: string }) {
  const rules = passwordRules(value);
  return (
    <div>
      <p className="font-medium text-[13px] text-text leading-[18px] tracking-[-0.13px]">
        Your password must contain
      </p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className="flex items-center gap-2 text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]"
          >
            <span
              className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
                rule.met ? "bg-success text-static-white" : "bg-bg-fill4 text-text-tertiary"
              }`}
            >
              <CheckIcon size={12} />
            </span>
            {rule.label}
            <span className="sr-only">{rule.met ? " (done)" : " (not yet)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
