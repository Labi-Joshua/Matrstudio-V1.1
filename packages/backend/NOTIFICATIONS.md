# Notifications

In-app notifications for a learner. Shared types live in `packages/types` (`AppNotification`, `NotificationKind`, `NOTIFICATION_KINDS`, `markNotificationsReadSchema`). Curator decisions on submissions are not stored here: the web derives them from the submissions API.

All routes sit under `/api/me/notifications`: Origin check, security headers, `requireAuthSecret` (503 `auth_unavailable`) and `requireSession` (401 `unauthorized`) apply. No captcha. Errors are `{ code, message, ...extra }`. **Times are ISO 8601 strings.** The user always comes from the session, so a learner only ever reads or changes their own rows.

## Endpoints

- `GET /api/me/notifications` -> 200 `{ notifications: [{ id, kind, title, body, href, createdAt, readAt }] }`, newest first, at most 50. `href` is a site path (`/learn/...`) or `null`; `readAt` is `null` while unread.
- `POST /api/me/notifications/read` body `{ ids?: string[] }` (max 50; omit the body or `ids` for all) -> 200 `{ updated: number }`. Only the caller's unread rows count, so unknown or foreign ids are ignored. `ids: []` updates nothing.

Kinds: `path-reminder`, `new-lesson`, `support-reply`, `report-fixed`, `report-cant-reproduce`.

## Error codes

| Status | code | When |
| --- | --- | --- |
| 400 | `invalid_request` | `ids` is not an array of at most 50 strings, or unknown fields |
| 401 | `unauthorized` | no session |
| 429 | `rate_limited` | more than 300 mark-read calls per hour per user; `retryAfterSeconds` and `Retry-After`. GET is not limited |
| 503 | `auth_unavailable` | `BETTER_AUTH_SECRET` missing or weak |

## Creating notifications

`createNotification(db, { userId, kind, title, body, href? })` in `src/notifications/create.ts` returns the new id. It rejects unknown kinds and any `href` that is not a site path (starts with `/`, not `//`), and clips `title` to 120 and `body` to 300 characters. The support admin routes use it; the path reminder job will too. Text is plain: the web renders it as text.

## Data

Migration `migrations/0009_notifications.sql`: `notifications(id, user_id, kind, title, body, href, created_at, read_at)` (unix seconds in the database), index `(user_id, created_at DESC)`. `user_id` references `user(id) ON DELETE CASCADE`, so `DELETE /api/me` removes the rows (tested). `kind` is checked by the database.
