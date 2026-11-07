/**
 * Shared field rules for the auth screens. They mirror the server (packages/backend, Better Auth:
 * passwords are 12 to 128 characters) so a form never accepts what the API will refuse. Wording
 * comes from the Figma field-error frames (section "Create account: field errors"). Every
 * validator returns the message to show, or null when the value is fine.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const MESSAGES = {
  fullName: "Enter your full name.",
  email: "Enter a valid email address, like name@example.com.",
  passwordRequired: "Enter your password.",
  passwordTooShort: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  passwordTooLong: `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`,
  passwordCompromised:
    "This password has appeared in a data breach. Choose a different one that you don’t use elsewhere.",
  passwordMismatch: "The passwords don’t match.",
  confirmRequired: "Confirm your new password.",
  terms: "Agree to the Terms of Service and Privacy Policy to continue.",
} as const;

// Deliberately simple: one @, no spaces, a dot in the domain. The server (and the email itself)
// is the real check; this only catches typos before a round trip. 254 is the SMTP maximum.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(value: string): string {
  return value.trim();
}

export function validateEmail(value: string): string | null {
  const email = normaliseEmail(value);
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? null : MESSAGES.email;
}

export function validateFullName(value: string): string | null {
  return value.trim().length > 0 ? null : MESSAGES.fullName;
}

/** Sign in only needs a value: an old password is never re-judged against today's rules. */
export function validateCurrentPassword(value: string): string | null {
  return value.length > 0 ? null : MESSAGES.passwordRequired;
}

/** A password being chosen (create account, reset password). */
export function validateNewPassword(value: string): string | null {
  if (value.length === 0) return MESSAGES.passwordRequired;
  if (value.length < PASSWORD_MIN_LENGTH) return MESSAGES.passwordTooShort;
  if (value.length > PASSWORD_MAX_LENGTH) return MESSAGES.passwordTooLong;
  return null;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (confirmation.length === 0) return MESSAGES.confirmRequired;
  return password === confirmation ? null : MESSAGES.passwordMismatch;
}

export function validateTerms(accepted: boolean): string | null {
  return accepted ? null : MESSAGES.terms;
}

export type PasswordRule = { id: string; label: string; met: boolean };

/**
 * The "Your password must contain" checklist. The server only enforces length (plus a breach
 * check at submit time), so length is the only rule listed: showing rules the server does not
 * enforce would be misleading. Add rules here, in one place, if the server ever adds them.
 */
export function passwordRules(value: string): PasswordRule[] {
  return [
    {
      id: "length",
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      met: value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
    },
  ];
}
