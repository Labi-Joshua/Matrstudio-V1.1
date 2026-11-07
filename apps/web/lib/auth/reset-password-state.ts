import type { ApiFailure, ResetTokenStatus } from "./api";

/**
 * The reset-password page, as a state machine.
 * checking: asking the API whether the link is still good.  form: set a new password.
 * expired / invalid: the link cannot be used (Figma "Reset link expired").  offline: the check could
 * not reach the API.  updated: done (Figma "Password updated").
 */
export type ResetView = "checking" | "form" | "expired" | "invalid" | "offline" | "updated";

export type ResetState = {
  view: ResetView;
  submitting: boolean;
  /** A form-level failure (network, rate limit) shown as a toast. */
  failure: ApiFailure | null;
  /** Error to show under the new password field (too short, breached, ...). */
  passwordError: string | null;
};

export type ResetAction =
  | { type: "no_token" }
  | { type: "checked"; status: ResetTokenStatus }
  | { type: "check_failed"; failure: ApiFailure }
  | { type: "retry_check" }
  | { type: "submit" }
  | { type: "submit_failed"; failure: ApiFailure; passwordError: string | null }
  | { type: "submitted" }
  | { type: "dismiss" };

export const initialResetState: ResetState = {
  view: "checking",
  submitting: false,
  failure: null,
  passwordError: null,
};

export function resetReducer(state: ResetState, action: ResetAction): ResetState {
  switch (action.type) {
    case "no_token":
      return { ...state, view: "invalid" };
    case "checked":
      return {
        ...state,
        view: action.status === "ok" ? "form" : action.status,
      };
    case "check_failed":
      // A network failure is worth a retry screen. Anything else (for example the check endpoint
      // missing) falls through to the form: submitting validates the token again anyway.
      return {
        ...state,
        view: action.failure.code === "network_error" ? "offline" : "form",
      };
    case "retry_check":
      return { ...state, view: "checking" };
    case "submit":
      return { ...state, submitting: true, failure: null, passwordError: null };
    case "submit_failed": {
      const code = action.failure.code;
      if (code === "link_expired") return { ...state, submitting: false, view: "expired" };
      if (code === "INVALID_TOKEN" || code === "link_invalid") {
        return { ...state, submitting: false, view: "invalid" };
      }
      return {
        ...state,
        submitting: false,
        passwordError: action.passwordError,
        failure: action.passwordError ? null : action.failure,
      };
    }
    case "submitted":
      return { ...state, submitting: false, view: "updated" };
    case "dismiss":
      return { ...state, failure: null };
  }
}
