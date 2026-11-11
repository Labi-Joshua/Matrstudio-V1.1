/**
 * Client for /api/admin/* (same-origin: the admin Worker forwards /api/* to the API). The admin
 * session cookie is HttpOnly; the Cloudflare Access cookie travels with the request automatically.
 *
 * Functions never throw for API or network errors; they resolve to an ApiResult. `code` is the
 * API's error code (kept as a string: admin codes are listed in packages/backend/ADMIN*.md),
 * "network_error" when the fetch failed, or "invalid_response" when `parse` rejects the body.
 */
export type ApiFailure = {
  ok: false;
  code: string;
  message: string;
  status?: number;
  retryAfterSeconds?: number;
  /** field name -> first message, from 400 invalid_request answers. */
  fieldErrors?: Record<string, string>;
};
export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function fieldErrorsOf(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, v] of Object.entries(value)) {
    const text = Array.isArray(v) ? v.find((x) => typeof x === "string") : v;
    if (typeof text === "string") out[key] = text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const CODE_FOR_STATUS: Record<number, string> = {
  400: "invalid_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  429: "rate_limited",
  503: "unavailable",
};

/** Turns a non-2xx response into an ApiFailure. Exported for tests. */
export function normaliseFailure(
  status: number,
  body: unknown,
  retryAfterHeader?: string | null,
): ApiFailure {
  const record = isRecord(body) ? body : {};
  const code =
    typeof record.code === "string" && record.code
      ? record.code
      : (CODE_FOR_STATUS[status] ?? "unknown_error");
  const message =
    typeof record.message === "string" && record.message ? record.message : "Something went wrong.";
  const failure: ApiFailure = { ok: false, code, message, status };
  const retry = Number(record.retryAfterSeconds ?? retryAfterHeader);
  if (Number.isFinite(retry) && retry > 0) failure.retryAfterSeconds = Math.ceil(retry);
  const fieldErrors = fieldErrorsOf(record.fieldErrors);
  if (fieldErrors) failure.fieldErrors = fieldErrors;
  return failure;
}

export const networkFailure = (): ApiFailure => ({
  ok: false,
  code: "network_error",
  message: "We couldn’t reach the server.",
});

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * One admin request. `path` starts after /api/admin (e.g. "/team"). `parse` turns the JSON body
 * into the data the caller wants or returns undefined for a wrong shape (invalid_response).
 */
export async function adminRequest<T>(
  method: Method,
  path: string,
  parse: (json: unknown) => T | undefined,
  options: { body?: unknown; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`/api/admin${path}`, {
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
  if (!response.ok)
    return normaliseFailure(response.status, json, response.headers.get("retry-after"));
  const data = parse(json);
  return data === undefined
    ? {
        ok: false,
        code: "invalid_response",
        message: "The server sent a reply we couldn’t read.",
        status: response.status,
      }
    : { ok: true, data };
}

/** For endpoints whose body is ignored (204 or { ok: true }). */
export const ignoreBody = (): null => null;
