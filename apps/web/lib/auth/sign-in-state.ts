import type { ApiFailure, ApiResult } from "./api";

/** What the sign in form shows above the page as a toast (Figma: the error and loading frames). */
export type SignInNotice =
  | { kind: "wrong_credentials" }
  | { kind: "locked"; retryAfterSeconds: number }
  | { kind: "unverified"; email: string; resend: ResendStatus }
  | { kind: "network" }
  | { kind: "captcha"; code: "captcha_required" | "captcha_failed" | "captcha_unavailable" }
  | { kind: "magic_link_sent" }
  | { kind: "google_failed" }
  | { kind: "error"; failure: ApiFailure };

export type ResendStatus = "idle" | "sending" | "sent" | "limit" | "failed";

export type SignInState = {
  /** idle: ready. submitting / magic_sending: a request is in flight. redirecting: signed in. */
  phase: "idle" | "submitting" | "magic_sending" | "redirecting";
  /** Set once the API asks for a captcha (after 3 failed attempts); stays set for the visit. */
  needsCaptcha: boolean;
  notice: SignInNotice | null;
};

export type SignInAction =
  | { type: "submit" }
  | { type: "magic_submit" }
  | { type: "failed"; failure: ApiFailure; email: string }
  | { type: "succeeded" }
  | { type: "magic_sent" }
  | { type: "google_failed" }
  | { type: "dismiss" }
  | { type: "unlock" }
  | { type: "resend_start" }
  | { type: "resend_done"; result: ApiResult<unknown> };

export const initialSignInState: SignInState = { phase: "idle", needsCaptcha: false, notice: null };

/** Used when the API says "too many attempts" without saying how long (15 minutes, as designed). */
export const DEFAULT_LOCK_SECONDS = 15 * 60;

/** Maps a failed sign in call to the notice to show (exported for tests). */
export function noticeFromFailure(failure: ApiFailure, email: string): SignInNotice {
  switch (failure.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return { kind: "wrong_credentials" };
    case "too_many_attempts":
    case "rate_limited":
      return {
        kind: "locked",
        retryAfterSeconds: failure.retryAfterSeconds ?? DEFAULT_LOCK_SECONDS,
      };
    case "email_not_verified":
      return { kind: "unverified", email, resend: "idle" };
    case "network_error":
      return { kind: "network" };
    case "captcha_required":
    case "captcha_failed":
    case "captcha_unavailable":
      return { kind: "captcha", code: failure.code };
    default:
      return { kind: "error", failure };
  }
}

function resendStatusFrom(result: ApiResult<unknown>): ResendStatus {
  if (result.ok) return "sent";
  return result.code === "resend_limit_reached" || result.code === "rate_limited"
    ? "limit"
    : "failed";
}

export function signInReducer(state: SignInState, action: SignInAction): SignInState {
  switch (action.type) {
    case "submit":
      return { ...state, phase: "submitting", notice: null };
    case "magic_submit":
      return { ...state, phase: "magic_sending", notice: null };
    case "failed": {
      const needsCaptcha =
        state.needsCaptcha ||
        action.failure.code === "captcha_required" ||
        action.failure.code === "captcha_failed";
      return {
        phase: "idle",
        needsCaptcha,
        notice: noticeFromFailure(action.failure, action.email),
      };
    }
    case "succeeded":
      return { ...state, phase: "redirecting", notice: null };
    case "magic_sent":
      return { ...state, phase: "idle", notice: { kind: "magic_link_sent" } };
    case "google_failed":
      return { ...state, notice: { kind: "google_failed" } };
    case "dismiss":
      return { ...state, notice: null };
    case "unlock":
      return state.notice?.kind === "locked" ? { ...state, notice: null } : state;
    case "resend_start":
      return state.notice?.kind === "unverified"
        ? { ...state, notice: { ...state.notice, resend: "sending" } }
        : state;
    case "resend_done":
      return state.notice?.kind === "unverified"
        ? { ...state, notice: { ...state.notice, resend: resendStatusFrom(action.result) } }
        : state;
  }
}
