import type { ApiErrorCode, ApiFailure } from "./api";
import { MESSAGES } from "./validation";

export type FailureCopy = { title: string; description: string };

/** "15 minutes", "1 minute", "45 seconds": for rate-limit messages. */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

const COPY: Partial<Record<ApiErrorCode, FailureCopy>> = {
  network_error: {
    title: "Something went wrong",
    description: "We couldn’t reach Matr Studio. Check your connection and try again.",
  },
  INVALID_EMAIL_OR_PASSWORD: {
    title: "Incorrect email or password",
    description: "Check your details and try again, or reset your password.",
  },
  email_not_verified: {
    title: "Confirm your email to continue",
    description: "We sent you a link when you signed up.",
  },
  captcha_required: {
    title: "One quick check",
    description: "Confirm you’re not a robot, then try again.",
  },
  captcha_failed: {
    title: "We couldn’t verify you",
    description: "Try the check again.",
  },
  captcha_unavailable: {
    title: "Verification is unavailable",
    description: "We can’t run the security check right now. Try again in a few minutes.",
  },
  resend_limit_reached: {
    title: "Too many emails",
    description: "You’ve reached the limit for resending. Try again later.",
  },
  link_expired: {
    title: "This link has expired",
    description: "Request a new link to continue.",
  },
  INVALID_TOKEN: {
    title: "This link isn’t valid",
    description: "Request a new link to continue.",
  },
  forbidden_origin: {
    title: "Something went wrong",
    description: "Reload the page and try again.",
  },
  PASSWORD_COMPROMISED: {
    title: "Choose a different password",
    description: MESSAGES.passwordCompromised,
  },
  PASSWORD_TOO_SHORT: { title: "Password too short", description: MESSAGES.passwordTooShort },
  PASSWORD_TOO_LONG: { title: "Password too long", description: MESSAGES.passwordTooLong },
};

/**
 * Title and description to show for a failed call. Written for the UI, so screens do not echo
 * raw server messages. Rate limits include the wait when the API says how long.
 */
export function authErrorCopy(failure: ApiFailure): FailureCopy {
  if (failure.code === "too_many_attempts" || failure.code === "rate_limited") {
    const wait = failure.retryAfterSeconds ? formatWait(failure.retryAfterSeconds) : null;
    return {
      title: "Too many attempts",
      description: wait
        ? `Please wait ${wait} and try again.`
        : "Please wait a little while and try again.",
    };
  }
  return (
    COPY[failure.code] ?? {
      title: "Something went wrong",
      description: "We couldn’t complete that. Try again in a moment.",
    }
  );
}
