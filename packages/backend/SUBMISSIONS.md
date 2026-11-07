# Resource submissions

Learners suggest resources (links) for the catalogue. A curator reviews each one later (admin queue not built yet; `reviewSubmission` in `src/auth/submissions.ts` is the internal entry point). Shared types and zod schemas live in `packages/types` (`createSubmissionSchema`, `updateSubmissionSchema`, `Submission`, `SubmissionStatus`, `TOPICS`).

All routes sit under `/api/me/*`: Origin check, security headers, `requireAuthSecret` (503 `auth_unavailable` without a proper secret) and `requireSession` (401 `unauthorized`) apply. Errors are `{ code, message, ...extra }`. Times are unix seconds. The server never fetches a submitted URL.

## Endpoints

### POST /api/me/submissions
Body (strict, unknown fields rejected): `{ url, title?, note?, topic? }`. All strings are trimmed; `url` max 2048, `title` max 200, `note` max 1000; empty `title`/`note` become null; `topic` is one of `ui-ux, brand, product, seo, social-media, design-systems, dev-handoff`. Send the Turnstile token in `X-Captcha-Response`.

201 `{ submission: { id, url, title, note, topic, status: "in_review", curatorNote: null, createdAt, updatedAt } }`.

### GET /api/me/submissions
200 `{ submissions: [...] }`, the caller's own rows only, newest first, max 100. Same item shape; `curatorNote` is set after a decision.

### PATCH /api/me/submissions/{id}
Body `{ title?, note?, topic? }` (at least one; `null` clears). Only status `needs_changes` is editable; success sets status back to `in_review` and bumps `updatedAt`. The URL cannot change. 200 `{ submission }`.

Statuses: `in_review | accepted | declined | needs_changes`.

## Error codes

| Status | code | When |
| --- | --- | --- |
| 400 | `invalid_request` | bad shape or length, unknown field; `fieldErrors?: { url?, title?, note?, topic? }` |
| 400 | `invalid_url` | not https, credentials in the URL, invalid host, IP literal, `localhost`, `*.local`, `*.internal`, single-label host |
| 400 | `captcha_required` / `captcha_failed` | missing or rejected Turnstile token |
| 401 | `unauthorized` | no session |
| 404 | `not_found` | missing or someone else's id (identical bodies) |
| 409 | `already_submitted` | same user, same normalised URL |
| 409 | `not_editable` | PATCH on a status other than `needs_changes` |
| 429 | `rate_limited` | 10/hour per user and 10/hour per network; `retryAfterSeconds` and `Retry-After` |
| 503 | `captcha_unavailable` | Turnstile down, or no secret in production (fails closed; skipped in development) |
| 503 | `auth_unavailable` | `BETTER_AUTH_SECRET` missing or weak |

Check order on create: body shape, URL rules, rate limits, captcha, insert (duplicate). Invalid requests do not use up the rate limit.

## URL normalisation (duplicate key)

Scheme and host lower-cased, default port and fragment dropped, trailing slash removed from the path, `utm_*`, `fbclid` and `gclid` params removed. Other query params and path case are kept. The stored `url` is what the learner typed (trimmed); `url_normalised` backs the unique index `(user_id, url_normalised)`.

## Data

Migration `migrations/0006_resource_submissions.sql`. `user_id` references `user(id) ON DELETE CASCADE`, so `DELETE /api/me` removes the learner's submissions (tested). Audit events `submission.created`, `submission.edited`, `submission.reviewed` hold ids and status only (never URLs, titles or notes). Titles and notes are plain text, stored as given and never interpreted; the web must render them as text.
