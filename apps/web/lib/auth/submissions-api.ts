import { isRecord, orNull, request } from "./api";

/**
 * Typed client for the learner's resource submissions (same-origin, session cookie, no token in
 * JavaScript). Like the rest of lib/auth/api.ts these functions never throw: they resolve to an
 * ApiResult. Nothing here logs; submitted URLs are user data and stay out of the console.
 *
 * Calls and the failures to expect:
 * - POST  /api/me/submissions {url, title?, note?, topic?} -> 201 {submission}. 400 invalid_request
 *   (fieldErrors?), 400 invalid_url, 409 already_submitted, 400 captcha_required / captcha_failed
 *   (header X-Captcha-Response), 429 rate_limited (retryAfterSeconds).
 * - GET   /api/me/submissions -> {submissions: [...]}.
 * - PATCH /api/me/submissions/{id} {title?, note?, topic?} -> 200 {submission}. 409 not_editable
 *   (only status needs_changes can be edited), 404 not_found.
 */
export const SUBMISSION_STATUSES = ["in_review", "accepted", "declined", "needs_changes"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export type Submission = {
  id: string;
  url: string;
  title: string | null;
  note: string | null;
  /** A catalogue topic slug, or null. */
  topic: string | null;
  status: SubmissionStatus;
  /** What the curator wrote when they declined or asked for changes. */
  curatorNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewSubmission = {
  url: string;
  title?: string;
  note?: string;
  topic?: string;
  /** Turnstile token, sent as X-Captcha-Response. */
  captchaToken?: string | null;
};

export type SubmissionEdit = { title?: string; note?: string; topic?: string };

/** Exported for tests. Undefined when the payload is not a usable submission. */
export function parseSubmission(json: unknown): Submission | undefined {
  if (!isRecord(json)) return undefined;
  const { id, url, status, createdAt, updatedAt } = json;
  if (
    typeof id !== "string" ||
    typeof url !== "string" ||
    typeof createdAt !== "string" ||
    typeof updatedAt !== "string" ||
    typeof status !== "string" ||
    !(SUBMISSION_STATUSES as readonly string[]).includes(status)
  ) {
    return undefined;
  }
  return {
    id,
    url,
    title: orNull(json.title),
    note: orNull(json.note),
    topic: orNull(json.topic),
    status: status as SubmissionStatus,
    curatorNote: orNull(json.curatorNote),
    createdAt,
    updatedAt,
  };
}

/** Exported for tests. Rows that cannot be read are dropped; an answer without a list is invalid. */
export function parseSubmissionList(json: unknown): Submission[] | undefined {
  if (!isRecord(json) || !Array.isArray(json.submissions)) return undefined;
  return json.submissions.flatMap((row) => {
    const parsed = parseSubmission(row);
    return parsed ? [parsed] : [];
  });
}

function parseOne(json: unknown): Submission | undefined {
  return isRecord(json) ? parseSubmission(json.submission) : undefined;
}

function compact<T extends Record<string, string | undefined>>(fields: T) {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
}

export function createSubmission(input: NewSubmission, signal?: AbortSignal) {
  return request(
    "POST",
    "/api/me/submissions",
    {
      body: {
        url: input.url,
        ...compact({ title: input.title, note: input.note, topic: input.topic }),
      },
      captchaToken: input.captchaToken,
      signal,
    },
    parseOne,
  );
}

export function listSubmissions(signal?: AbortSignal) {
  return request("GET", "/api/me/submissions", { signal }, parseSubmissionList);
}

export function updateSubmission(id: string, edit: SubmissionEdit, signal?: AbortSignal) {
  return request(
    "PATCH",
    `/api/me/submissions/${encodeURIComponent(id)}`,
    { body: compact(edit), signal },
    parseOne,
  );
}
