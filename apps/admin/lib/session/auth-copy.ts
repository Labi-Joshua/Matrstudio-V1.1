import type { ApiFailure } from "../api";

/** Messages for the sign-in, 2-step and invite screens (wording from Figma "Admin - Auth and navigation"). */

export type AuthProblem =
  | { kind: "wrong"; message: string }
  | { kind: "paused"; retryAfterSeconds: number }
  | { kind: "server"; message: string }
  | { kind: "offline"; message: string }
  | { kind: "session"; message: string };

const DEFAULT_PAUSE_SECONDS = 15 * 60;

/** Sorts an API failure into what the screen should show. */
export function problemFrom(failure: ApiFailure): AuthProblem {
  switch (failure.code) {
    case "too_many_attempts":
    case "rate_limited":
      return {
        kind: "paused",
        retryAfterSeconds: failure.retryAfterSeconds ?? DEFAULT_PAUSE_SECONDS,
      };
    case "invalid_credentials":
      return { kind: "wrong", message: "Check your email and password and try again." };
    case "invalid_code":
      return {
        kind: "wrong",
        message: "That code didn’t work. Codes change every 30 seconds, so use the newest one.",
      };
    case "reauth_failed":
      return { kind: "wrong", message: "That didn’t match. Check your password and code." };
    case "unauthorized":
      return {
        kind: "session",
        message: "Your sign-in timed out. Enter your email and password again.",
      };
    case "network_error":
      return {
        kind: "offline",
        message: "We couldn’t reach the server. Check your connection and try again.",
      };
    case "invalid_request":
      return { kind: "wrong", message: failure.message };
    default:
      return {
        kind: "server",
        message: "Something went wrong on our side. Try again in a moment.",
      };
  }
}

/** Same rules as the invite screen's helper text (the server adds a breach check on top). */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (!/\d/.test(password)) return "Add at least one number.";
  if (!/[^\p{L}\p{N}\s]/u.test(password)) return "Add at least one symbol.";
  if (password.length > 128) return "Use 128 characters or fewer.";
  return null;
}

export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** A 6-digit authenticator code. */
export const isSixDigits = (value: string): boolean => /^\d{6}$/.test(value);

/** A backup code as printed ("XXXXX-XXXXX" or "XXXX-XXXX"): letters, digits and a dash, 6 to 16 long. */
export const isBackupCode = (value: string): boolean => /^[A-Za-z0-9-]{6,16}$/.test(value.trim());

/** Backup codes as plain text for "Copy codes" and "Download .txt". */
export const backupCodesText = (codes: readonly string[]): string =>
  `Matr Studio admin backup codes\nEach code works once.\n\n${codes.join("\n")}\n`;
