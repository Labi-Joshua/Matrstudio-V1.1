# Support tickets and reports

Learners write to support or report a problem. Shared types live in `packages/types` (`SupportTicket`, `SupportMessage`, `SupportStatus`, `createSupportTicketSchema`, `supportFollowUpSchema`, `adminSupportStatusSchema`, `SupportErrorBody`).

Learner routes sit under `/api/me/support`: Origin check, security headers, `requireAuthSecret` (503 `auth_unavailable`) and `requireSession` (401 `unauthorized`) apply. Errors are `{ code, message, ...extra }`. **Times are ISO 8601 strings.** The user always comes from the session; another learner's ticket is a 404, never a 403.

Ticket: `{ id, kind: 'support'|'report', category, subject, status, createdAt, updatedAt, messageCount, context: { resource, where, link } | null, messages? }`, message: `{ id, author: 'you'|'support', body, createdAt }`. Status: `open`, `replied`, `resolved`, `fixed`, `cant_reproduce` (the last three are closed).

## Learner endpoints

- `POST /api/me/support` header `X-Captcha-Response` (Turnstile, same rules as submissions), body `{ kind, category?, subject? (<=120, default: first 60 characters of the message, or "Report"), message (10..2000), context?: { resource? (<=200), where? (<=200), link? (https, <=500) } }` -> 201 `{ ticket }` with its first message. Queues the "we got it" email. 10 per hour per user and per network.
- `GET /api/me/support` -> `{ tickets }` without messages, newest first, max 100.
- `GET /api/me/support/{id}` -> `{ ticket }` with messages.
- `POST /api/me/support/{id}/messages` body `{ message }` (1..2000) -> 201 `{ ticket }`; sets the status back to `open`. 30 per hour per user.

Ids in URLs must match `^[a-z0-9][a-z0-9-]{0,63}$` (checked before any rate limit is spent).

## Admin endpoints (no admin UI yet)

Behind Cloudflare Access, an admin session and the `support_inbox` area at `manage` (the area already existed in the role system; a custom role can hold up to `manage` on it). Admin origin only.

- `POST /api/admin/support/{id}/reply` body `{ message }` (1..2000) -> 200 `{ ticket }`; adds a staff message, status `replied`.
- `POST /api/admin/support/{id}/status` body `{ status: 'resolved'|'fixed'|'cant_reproduce' }` -> 200 `{ ticket }`. `fixed` and `cant_reproduce` are for `report` tickets only (400 for a `support` ticket).

Each one creates the learner's notification (href `/learn/help?ticket={id}`), queues an email and writes an audit event. Notification kinds: reply -> `support-reply`; `resolved` -> `support-reply`; `fixed` -> `report-fixed`; `cant_reproduce` -> `report-cant-reproduce`. Emails: `support-received`, `support-reply`, `support-closed` (links only to the website help centre, user text escaped, no codes). A closed ticket cannot be replied to or changed again (409).

## Error codes

| Status | code | When |
| --- | --- | --- |
| 400 | `invalid_request` | validation (with `fieldErrors` keyed by `kind`, `category`, `subject`, `message`, `context`), bad id, admin status not allowed for the ticket kind |
| 400 | `captcha_required` / `captcha_failed` | missing or wrong Turnstile token on create |
| 401 | `unauthorized` | no session (admin: no admin session or Access identity mismatch) |
| 403 | `forbidden` | admin role below `manage` on `support_inbox`; `access_denied` without a Cloudflare Access token |
| 404 | `not_found` | unknown ticket or somebody else's |
| 409 | `ticket_closed` | follow-up, reply or status change on a resolved, fixed or can't-reproduce ticket |
| 429 | `rate_limited` | `retryAfterSeconds` and `Retry-After` |
| 503 | `captcha_unavailable` / `auth_unavailable` | Turnstile cannot be checked (production without a secret) / weak or missing auth secret |

## Data

Migration `migrations/0010_support_tickets.sql`: `support_tickets` and `support_messages` (unix seconds in the database), both cascading on user delete, so `DELETE /api/me` removes them (tested). Audit events `support.created`, `support.message`, `support.replied`, `support.status_changed` hold the ticket id, kind and status only, never the text or the address.
