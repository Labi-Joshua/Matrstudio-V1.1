import type { ApiFailure } from "../auth/api";
import { formatWait } from "../auth/messages";
import {
  MESSAGES,
  normaliseEmail,
  validateCurrentPassword,
  validateEmail,
  validateNewPassword,
  validatePasswordConfirmation,
} from "../auth/validation";

/** Form rules and failure wording for the Settings dialogs. Pure, so the copy is testable. */

export type EmailForm = { newEmail: string; password: string };
export type EmailErrors = { newEmail?: string; password?: string };

/** `current` is the address now on the account; `needsPassword` when the session is not fresh. */
export function validateEmailChange(
  form: EmailForm,
  current: string,
  needsPassword: boolean,
): EmailErrors {
  const errors: EmailErrors = {};
  const email = validateEmail(form.newEmail);
  if (email) errors.newEmail = email;
  else if (normaliseEmail(form.newEmail).toLowerCase() === current.trim().toLowerCase()) {
    errors.newEmail = "That’s already your email address.";
  }
  if (needsPassword) {
    const password = validateCurrentPassword(form.password);
    if (password) errors.password = password;
  }
  return errors;
}

export type PasswordForm = { current: string; next: string; confirm: string };
export type PasswordErrors = { current?: string; next?: string; confirm?: string };

/** `hasPassword` false is the "set a password" form of a Google-only account: no current one. */
export function validatePasswordChange(form: PasswordForm, hasPassword: boolean): PasswordErrors {
  const errors: PasswordErrors = {};
  if (hasPassword) {
    const current = validateCurrentPassword(form.current);
    if (current) errors.current = current;
  }
  const next = validateNewPassword(form.next);
  if (next) errors.next = next;
  else if (hasPassword && form.next === form.current) {
    errors.next = "Choose a password different from your current one.";
  }
  const confirm = validatePasswordConfirmation(form.next, form.confirm);
  if (confirm) errors.confirm = confirm;
  return errors;
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0;

export type FormOutcome =
  | { kind: "reauth" }
  | { kind: "field"; field: "password" | "current" | "next" | "newEmail"; message: string }
  | { kind: "banner"; title: string; message: string; retryAfterSeconds?: number };

const WAIT = (f: ApiFailure) =>
  f.retryAfterSeconds ? ` Try again in ${formatWait(f.retryAfterSeconds)}.` : " Try again later.";

/** What a failed email-change, password or delete request means for the dialog that sent it. */
export function formOutcome(
  failure: ApiFailure,
  kind: "email" | "password" | "set-password" | "delete",
  sentPassword: boolean,
): FormOutcome {
  const { code } = failure;
  if (
    code === "reauth_required" ||
    (code === "unauthorized" && failure.status === 401 && kind !== "password")
  ) {
    if (kind === "delete" || kind === "email") {
      return sentPassword
        ? { kind: "field", field: "password", message: "That password isn’t right." }
        : { kind: "reauth" };
    }
    return { kind: "reauth" };
  }
  if (code === "INVALID_PASSWORD") {
    return { kind: "field", field: "current", message: "That isn’t your current password." };
  }
  if (code === "PASSWORD_COMPROMISED") {
    return { kind: "field", field: "next", message: MESSAGES.passwordCompromised };
  }
  if (code === "PASSWORD_TOO_SHORT") {
    return { kind: "field", field: "next", message: MESSAGES.passwordTooShort };
  }
  if (code === "PASSWORD_TOO_LONG") {
    return { kind: "field", field: "next", message: MESSAGES.passwordTooLong };
  }
  if (code === "rate_limited" || code === "too_many_attempts") {
    return {
      kind: "banner",
      title: "Too many attempts",
      message: `You’ve tried too many times.${WAIT(failure)}`,
      retryAfterSeconds: failure.retryAfterSeconds,
    };
  }
  if (code === "network_error") {
    return {
      kind: "banner",
      title: "Something went wrong",
      message: "We couldn’t reach Matr Studio. Check your connection and try again.",
    };
  }
  return {
    kind: "banner",
    title: "Something went wrong",
    message: "We couldn’t save that. Try again in a moment.",
  };
}
