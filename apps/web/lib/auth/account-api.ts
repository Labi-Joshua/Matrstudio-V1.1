import { type ApiFailure, type ApiResult, isRecord, networkFailure, request } from "./api";

/**
 * Typed client for the account settings (packages/backend/SETTINGS.md). Same rules as
 * lib/auth/api.ts: nothing throws, every call resolves to an ApiResult, nothing logs. Emails and
 * passwords are never logged or kept.
 */
export type AccountSummary = {
  hasPassword: boolean;
  google: { linked: boolean };
  passkeyCount: number;
  pendingEmail: { email: string; requestedAt: string; expiresAt: string } | null;
  counts: { saved: number; submissions: number };
};

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Exported for tests. Undefined when the payload is not a usable account summary. */
export function parseAccount(json: unknown): AccountSummary | undefined {
  const a = isRecord(json) && isRecord(json.account) ? json.account : undefined;
  if (!a || typeof a.hasPassword !== "boolean") return undefined;
  const pending = isRecord(a.pendingEmail) ? a.pendingEmail : null;
  const counts = isRecord(a.counts) ? a.counts : {};
  return {
    hasPassword: a.hasPassword,
    google: { linked: isRecord(a.google) && a.google.linked === true },
    passkeyCount: count(a.passkeyCount),
    pendingEmail:
      pending && typeof pending.email === "string"
        ? {
            email: pending.email,
            requestedAt: typeof pending.requestedAt === "string" ? pending.requestedAt : "",
            expiresAt: typeof pending.expiresAt === "string" ? pending.expiresAt : "",
          }
        : null,
    counts: { saved: count(counts.saved), submissions: count(counts.submissions) },
  };
}

const pendingEmail = (json: unknown) =>
  isRecord(json) && typeof json.pendingEmail === "string" ? json.pendingEmail : undefined;
const flag = (key: string) => (json: unknown) =>
  isRecord(json) && json[key] === true ? (true as const) : undefined;

/**
 * The API's own codes that lib/auth/api.ts does not list arrive as the status default (409
 * becomes unknown_error); this gives them back their meaning so screens can switch on them.
 */
export type AccountFailureKind = "last_sign_in_method" | "password_exists";
export function accountFailureKind(failure: ApiFailure): AccountFailureKind | null {
  if (failure.status !== 409) return null;
  return /password first|only way/i.test(failure.message)
    ? "last_sign_in_method"
    : "password_exists";
}

export function getAccount(signal?: AbortSignal) {
  return request("GET", "/api/me/account", { signal }, parseAccount);
}

/** 401 reauth_required (sign in again, or send the password), 400 invalid_request, 429. */
export function requestEmailChange(
  input: { newEmail: string; password?: string },
  signal?: AbortSignal,
) {
  return request("POST", "/api/me/account/email", { body: input, signal }, pendingEmail);
}

export function resendEmailChange(signal?: AbortSignal) {
  return request("POST", "/api/me/account/email/resend", { body: {}, signal }, pendingEmail);
}

export function cancelEmailChange(signal?: AbortSignal) {
  return request("DELETE", "/api/me/account/email", { signal }, flag("cancelled"));
}

/** Better Auth: a wrong current password is INVALID_PASSWORD; also PASSWORD_COMPROMISED, PASSWORD_TOO_*. */
export function changePassword(
  input: { currentPassword: string; newPassword: string },
  signal?: AbortSignal,
) {
  return request("POST", "/api/auth/change-password", { body: input, signal }, () => true as const);
}

/** For accounts without a password. 401 reauth_required unless the session is under 5 minutes old. */
export function setPassword(newPassword: string, signal?: AbortSignal) {
  return request(
    "POST",
    "/api/me/account/password",
    { body: { newPassword }, signal },
    flag("hasPassword"),
  );
}

/** 409: Google is the only way in (accountFailureKind). */
export function unlinkGoogle(signal?: AbortSignal) {
  return request("DELETE", "/api/me/account/google", { signal }, flag("unlinked"));
}

/** Deletes the account. `password` is only needed when the session is older than 5 minutes. */
export function deleteAccount(password?: string, signal?: AbortSignal) {
  return request(
    "DELETE",
    "/api/me/account",
    { body: password ? { password } : {}, signal },
    flag("deleted"),
  );
}

/**
 * Starts linking Google: asks for the URL and navigates the browser to it (https only). The
 * learner comes back to `callbackURL`.
 */
export async function startGoogleLink(callbackURL: string): Promise<ApiResult<null>> {
  const result = await request(
    "POST",
    "/api/auth/link-social",
    { body: { provider: "google", callbackURL } },
    (json) => (isRecord(json) && typeof json.url === "string" ? json.url : undefined),
  );
  if (!result.ok) return result;
  let target: URL;
  try {
    target = new URL(result.data);
  } catch {
    return networkFailure();
  }
  if (target.protocol !== "https:") return networkFailure();
  window.location.assign(target.toString());
  return { ok: true, data: null };
}

/** The learner's data as a JSON file. Resolves to the file contents as a Blob. */
export async function downloadMyData(signal?: AbortSignal): Promise<ApiResult<Blob>> {
  let response: Response;
  try {
    response = await fetch("/api/me/account/export", {
      credentials: "include",
      cache: "no-store",
      signal,
    });
  } catch {
    return networkFailure();
  }
  if (!response.ok) {
    return {
      ok: false,
      code:
        response.status === 429
          ? "rate_limited"
          : response.status === 401
            ? "unauthorized"
            : "unknown_error",
      message: "Couldn’t download your data.",
      status: response.status,
    };
  }
  return { ok: true, data: await response.blob() };
}
