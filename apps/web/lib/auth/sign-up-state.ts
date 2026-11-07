import type { ApiFailure, ApiResult } from "./api";
import { MESSAGES } from "./validation";

/** Shown in the field under the email when the address already has an account (Figma "email already registered"). */
export const EMAIL_REGISTERED_MESSAGE = "This email already has a Matr Studio account.";

/** What the create account screens show as a toast. */
export type SignUpNotice =
  | { kind: "already_registered" }
  | { kind: "network" }
  | { kind: "captcha"; code: "captcha_required" | "captcha_failed" | "captcha_unavailable" }
  | { kind: "rate_limited"; retryAfterSeconds: number | null }
  | { kind: "invite_invalid" }
  | { kind: "google_failed" }
  /** Back from Google with an email that already has an account. */
  | { kind: "google_registered" }
  | { kind: "server" };

export type SignUpOutcome = {
  notice: SignUpNotice | null;
  /** Message for the email field, when the failure is about the email. */
  emailError: string | null;
  /** Message for the password field, when the failure is about the password. */
  passwordError: string | null;
  /** True once the API asked for a captcha: the widget stays up for the rest of the visit. */
  needsCaptcha: boolean;
};

/** Maps a failed create account (or accept invite) call to what the screen shows (exported for tests). */
export function outcomeFromFailure(failure: ApiFailure): SignUpOutcome {
  const base: SignUpOutcome = {
    notice: null,
    emailError: null,
    passwordError: null,
    needsCaptcha: false,
  };
  switch (failure.code) {
    case "email_already_registered":
      return {
        ...base,
        notice: { kind: "already_registered" },
        emailError: EMAIL_REGISTERED_MESSAGE,
      };
    case "PASSWORD_TOO_SHORT":
      return { ...base, passwordError: MESSAGES.passwordTooShort };
    case "PASSWORD_TOO_LONG":
      return { ...base, passwordError: MESSAGES.passwordTooLong };
    case "PASSWORD_COMPROMISED":
      return { ...base, passwordError: MESSAGES.passwordCompromised };
    case "captcha_required":
    case "captcha_failed":
      return { ...base, needsCaptcha: true, notice: { kind: "captcha", code: failure.code } };
    case "captcha_unavailable":
      return { ...base, notice: { kind: "captcha", code: failure.code } };
    case "too_many_attempts":
    case "rate_limited":
      return {
        ...base,
        notice: { kind: "rate_limited", retryAfterSeconds: failure.retryAfterSeconds ?? null },
      };
    case "invite_invalid":
      return { ...base, notice: { kind: "invite_invalid" } };
    case "network_error":
      return { ...base, notice: { kind: "network" } };
    default:
      return { ...base, notice: { kind: "server" } };
  }
}

/** Seconds a learner waits before asking for another confirmation email (client side courtesy). */
export const RESEND_COOLDOWN_SECONDS = 60;

export type ResendOutcome =
  | { kind: "sent" }
  /** Wait this long (the API's rate limit). */
  | { kind: "wait"; seconds: number }
  /** The cap on resends: no point retrying soon. */
  | { kind: "limit_reached" }
  | { kind: "needs_captcha"; code: "captcha_required" | "captcha_failed" }
  | { kind: "network" }
  | { kind: "failed" };

/** Maps the answer to "send the confirmation email again" (exported for tests). */
export function resendOutcome(result: ApiResult<unknown>): ResendOutcome {
  if (result.ok) return { kind: "sent" };
  switch (result.code) {
    case "rate_limited":
    case "too_many_attempts":
      return { kind: "wait", seconds: result.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS };
    case "resend_limit_reached":
      return { kind: "limit_reached" };
    case "captcha_required":
    case "captcha_failed":
      return { kind: "needs_captcha", code: result.code };
    case "network_error":
      return { kind: "network" };
    default:
      return { kind: "failed" };
  }
}

/** The states of the confirmation landing page (/email-confirmed). */
export type ConfirmationView = "confirmed" | "expired" | "invalid" | "already_confirmed";

/** `?error=` of the landing page: none is success, unknown values count as an unrecognised link. */
export function confirmationViewFromParam(error: string | null): ConfirmationView {
  if (error === "link_expired") return "expired";
  if (error === "already_confirmed") return "already_confirmed";
  if (error === null || error === "") return "confirmed";
  return "invalid";
}

/** Magic link failures that land on /sign-in?error= (the only two the API produces). */
export function signInLinkErrorFromParam(
  error: string | null,
): "link_expired" | "INVALID_TOKEN" | null {
  if (error === "link_expired" || error === "INVALID_TOKEN") return error;
  return null;
}

/** Errors Better Auth may redirect to /sign-up with after Google when the email already has an account. */
export function isGoogleRegisteredParam(error: string | null): boolean {
  return error === "account_not_linked" || error === "email_already_registered";
}
