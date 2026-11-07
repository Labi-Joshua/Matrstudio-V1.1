/**
 * Typed client for the learner auth API (packages/backend/AUTH.md). The site Worker forwards
 * /api/* to the API, so every URL is same-origin and relative; the session cookie is HttpOnly and
 * never visible to JavaScript (docs/SECURITY-AUTH.md section 3), so nothing here stores a token.
 *
 * Rules:
 * - Functions never throw for API or network errors. They resolve to an ApiResult: either
 *   { ok: true, data } or { ok: false, code, message, retryAfterSeconds?, status? }.
 * - `code` is always one of ApiErrorCode, so callers can switch on it exhaustively. Server codes
 *   we do not know become "unknown_error"; a fetch that fails becomes "network_error".
 * - Nothing here logs. Emails, passwords and tokens must never reach the console.
 */

/** Codes the API can answer with (AUTH.md), lower-case ours and upper-case Better Auth's. */
export const SERVER_ERROR_CODES = [
  "email_already_registered",
  "email_not_verified",
  "too_many_attempts",
  "rate_limited",
  "resend_limit_reached",
  "captcha_required",
  "captcha_failed",
  "captcha_unavailable",
  "invite_invalid",
  "link_expired",
  "link_invalid",
  "already_confirmed",
  "unauthorized",
  "reauth_required",
  "forbidden_origin",
  "forbidden",
  "invalid_request",
  "not_found",
  "INVALID_EMAIL_OR_PASSWORD",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "PASSWORD_COMPROMISED",
  "INVALID_TOKEN",
  "INVALID_PASSWORD",
] as const;

export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];

/** Server codes plus the three the client itself produces. */
export type ApiErrorCode = ServerErrorCode | "network_error" | "invalid_response" | "unknown_error";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  code: ApiErrorCode;
  /** Safe to show, but screens should prefer authErrorMessage(), which is written for the UI. */
  message: string;
  /** Present on 429 answers: how long to wait before trying again. */
  retryAfterSeconds?: number;
  status?: number;
};
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

const KNOWN_CODES: ReadonlySet<string> = new Set(SERVER_ERROR_CODES);

const FALLBACK_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  network_error: "We couldn’t reach Matr Studio.",
  invalid_response: "Matr Studio sent a reply we couldn’t read.",
  rate_limited: "Too many requests.",
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function codeFromStatus(status: number): ApiErrorCode {
  if (status === 400) return "invalid_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return "unknown_error";
}

function positiveSeconds(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.ceil(n) : undefined;
}

/**
 * Turns a non-2xx response into an ApiFailure. Exported for tests. `body` is the parsed JSON (or
 * undefined when the body was empty or not JSON); `retryAfterHeader` is the Retry-After header.
 */
export function normaliseFailure(
  status: number,
  body: unknown,
  retryAfterHeader?: string | null,
): ApiFailure {
  const record = isRecord(body) ? body : {};
  const rawCode = typeof record.code === "string" ? record.code : undefined;
  const code: ApiErrorCode =
    rawCode && KNOWN_CODES.has(rawCode) ? (rawCode as ServerErrorCode) : codeFromStatus(status);
  const message =
    typeof record.message === "string" && record.message.length > 0
      ? record.message
      : (FALLBACK_MESSAGES[code] ?? "Something went wrong.");
  const failure: ApiFailure = { ok: false, code, message, status };
  const retry = positiveSeconds(record.retryAfterSeconds) ?? positiveSeconds(retryAfterHeader);
  if (retry !== undefined) failure.retryAfterSeconds = retry;
  return failure;
}

export function networkFailure(): ApiFailure {
  return { ok: false, code: "network_error", message: FALLBACK_MESSAGES.network_error ?? "" };
}

function invalidResponse(status?: number): ApiFailure {
  return {
    ok: false,
    code: "invalid_response",
    message: FALLBACK_MESSAGES.invalid_response ?? "",
    ...(status === undefined ? {} : { status }),
  };
}

type RequestOptions = {
  body?: unknown;
  /** Turnstile token, sent as X-Captcha-Response (needed after the API answers captcha_required). */
  captchaToken?: string | null;
  signal?: AbortSignal;
};

/**
 * One request. `parse` turns the JSON body into the data the caller wants, or returns undefined
 * when the body has the wrong shape (reported as invalid_response).
 */
export async function request<T>(
  method: "GET" | "POST",
  path: string,
  options: RequestOptions,
  parse: (json: unknown) => T | undefined,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.captchaToken) headers["x-captcha-response"] = options.captchaToken;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "include",
      cache: "no-store",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    return networkFailure();
  }

  let json: unknown;
  try {
    const text = await response.text();
    json = text ? JSON.parse(text) : null;
  } catch {
    json = undefined;
  }

  if (!response.ok) {
    return normaliseFailure(response.status, json, response.headers.get("retry-after"));
  }
  const data = parse(json);
  return data === undefined ? invalidResponse(response.status) : { ok: true, data };
}

// ---------------------------------------------------------------------------------------------
// Response shapes (hand-checked: the web app has no schema library, and these are small).
// ---------------------------------------------------------------------------------------------

export type Me = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  onboarding: {
    goal: string | null;
    level: string | null;
    topics: string[];
    completed: boolean;
    completedAt: string | null;
  };
  providers: string[];
  passkeyCount: number;
};

export const orNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
export const stringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Exported for tests. Returns undefined when the payload is not a usable /api/me answer. */
export function parseMe(json: unknown): Me | undefined {
  if (!isRecord(json) || typeof json.id !== "string" || typeof json.email !== "string") {
    return undefined;
  }
  const onboarding = isRecord(json.onboarding) ? json.onboarding : {};
  return {
    id: json.id,
    email: json.email,
    name: orNull(json.name),
    emailVerified: json.emailVerified === true,
    onboarding: {
      goal: orNull(onboarding.goal),
      level: orNull(onboarding.level),
      topics: stringArray(onboarding.topics),
      completed: onboarding.completed === true,
      completedAt: orNull(onboarding.completedAt),
    },
    providers: stringArray(json.providers),
    passkeyCount: typeof json.passkeyCount === "number" ? json.passkeyCount : 0,
  };
}

const ignoreBody = (): null => null;

// ---------------------------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------------------------

export type SignInInput = {
  email: string;
  password: string;
  rememberMe?: boolean;
  /** Required after the API answers captcha_required (3 failed attempts). */
  captchaToken?: string | null;
};

/**
 * Email and password sign in. On success the session cookie is set by the response; the body's
 * token is dropped on purpose, JavaScript never needs it. Failures to expect:
 * INVALID_EMAIL_OR_PASSWORD, email_not_verified, too_many_attempts / rate_limited (with
 * retryAfterSeconds), captcha_required, captcha_failed.
 */
export function signInWithEmail(input: SignInInput, signal?: AbortSignal) {
  return request(
    "POST",
    "/api/auth/sign-in/email",
    {
      body: { email: input.email, password: input.password, rememberMe: input.rememberMe ?? false },
      captchaToken: input.captchaToken,
      signal,
    },
    ignoreBody,
  );
}

/** Always succeeds with the generic message on the server side: never reveals if an account exists. */
export function requestMagicLink(
  input: { email: string; callbackURL?: string; captchaToken?: string | null },
  signal?: AbortSignal,
) {
  return request(
    "POST",
    "/api/auth/sign-in/magic-link",
    {
      body: {
        email: input.email,
        ...(input.callbackURL ? { callbackURL: input.callbackURL } : {}),
      },
      captchaToken: input.captchaToken,
      signal,
    },
    ignoreBody,
  );
}

/** Asks Google for a sign-in URL. Use startGoogleSignIn() unless you need the URL itself. */
export function requestSocialSignIn(
  input: { provider: "google"; callbackURL: string },
  signal?: AbortSignal,
) {
  return request("POST", "/api/auth/sign-in/social", { body: input, signal }, (json) =>
    isRecord(json) && typeof json.url === "string" ? { url: json.url } : undefined,
  );
}

/**
 * Starts Google sign in: asks the API for the URL, then navigates the browser to it. Only an
 * https URL is followed (never a javascript: or data: URL). Resolves with a failure when it could
 * not start; resolves with { ok: true } just before the page navigates away.
 */
export async function startGoogleSignIn(callbackURL: string): Promise<ApiResult<null>> {
  const result = await requestSocialSignIn({ provider: "google", callbackURL });
  if (!result.ok) return result;
  let target: URL;
  try {
    target = new URL(result.data.url);
  } catch {
    return invalidResponse();
  }
  if (target.protocol !== "https:") return invalidResponse();
  window.location.assign(target.toString());
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------------------------
// Create account
// ---------------------------------------------------------------------------------------------

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
  /** Required after the API answers captcha_required. */
  captchaToken?: string | null;
};

/**
 * Creates an account with email and password. Success (200) means a confirmation email was
 * queued: there is no session yet, so show the "check your inbox" state. Failures to expect:
 * email_already_registered (422), PASSWORD_TOO_SHORT / PASSWORD_TOO_LONG / PASSWORD_COMPROMISED,
 * captcha_required / captcha_failed / captcha_unavailable, rate_limited (with retryAfterSeconds).
 */
export function signUpWithEmail(input: SignUpInput, signal?: AbortSignal) {
  return request(
    "POST",
    "/api/auth/sign-up/email",
    {
      body: { name: input.name, email: input.email, password: input.password },
      captchaToken: input.captchaToken,
      signal,
    },
    ignoreBody,
  );
}

export type AcceptInviteInput = {
  token: string;
  name: string;
  password: string;
  captchaToken?: string | null;
};

/**
 * Creates an account from a waitlist invite. The invite is bound to its email, so none is sent.
 * Success (200) signs the learner in (session cookie) with the email already confirmed. Failures
 * to expect: invite_invalid (expired, used or unknown), email_already_registered, PASSWORD_*,
 * captcha_*, rate_limited.
 */
export function acceptInvite(input: AcceptInviteInput, signal?: AbortSignal) {
  return request(
    "POST",
    "/api/auth/invite/accept",
    {
      body: { token: input.token, name: input.name, password: input.password },
      captchaToken: input.captchaToken,
      signal,
    },
    ignoreBody,
  );
}

// ---------------------------------------------------------------------------------------------
// Password reset and email confirmation
// ---------------------------------------------------------------------------------------------

/** Always answers 200 with a generic message, so show the same screen whatever the email. */
export function requestPasswordReset(
  input: { email: string; captchaToken?: string | null },
  signal?: AbortSignal,
) {
  return request(
    "POST",
    "/api/auth/request-password-reset",
    { body: { email: input.email }, captchaToken: input.captchaToken, signal },
    ignoreBody,
  );
}

/** Failures: link_expired or INVALID_TOKEN (send them to the expired screen), PASSWORD_*. */
export function resetPassword(input: { newPassword: string; token: string }, signal?: AbortSignal) {
  return request("POST", "/api/auth/reset-password", { body: input, signal }, ignoreBody);
}

export type ResetTokenStatus = "ok" | "expired" | "invalid";

/** Looks at a reset token without using it, so the page can show "expired" before asking for a password. */
export function checkResetToken(token: string, signal?: AbortSignal) {
  return request(
    "GET",
    `/api/auth/reset-password/check?token=${encodeURIComponent(token)}`,
    { signal },
    (json): ResetTokenStatus | undefined =>
      isRecord(json) &&
      (json.status === "ok" || json.status === "expired" || json.status === "invalid")
        ? json.status
        : undefined,
  );
}

/** Failure to expect: resend_limit_reached. */
export function sendVerificationEmail(
  input: { email: string; captchaToken?: string | null },
  signal?: AbortSignal,
) {
  return request(
    "POST",
    "/api/auth/send-verification-email",
    { body: { email: input.email }, captchaToken: input.captchaToken, signal },
    ignoreBody,
  );
}

// ---------------------------------------------------------------------------------------------
// Session and current user
// ---------------------------------------------------------------------------------------------

/** Resolves to { ok: true, data: boolean }: whether a session cookie is currently valid. */
export function getSession(signal?: AbortSignal) {
  return request("GET", "/api/auth/get-session", { signal }, (json) =>
    json === null ? false : isRecord(json) && isRecord(json.session) ? true : undefined,
  );
}

/** The signed-in learner. Failure code "unauthorized" means nobody is signed in. */
export function getMe(signal?: AbortSignal) {
  return request("GET", "/api/me", { signal }, parseMe);
}

export function signOut(signal?: AbortSignal) {
  return request("POST", "/api/auth/sign-out", { body: {}, signal }, ignoreBody);
}
