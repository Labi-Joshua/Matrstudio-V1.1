# Saved resources

Learners bookmark catalogue resources. Shared types live in `packages/types` (`SavedResource`, `SavedErrorBody`, `SAVED_LIMIT`, `savedResourceIdSchema`). The catalogue is not in the database yet, so `resourceId` is just the catalogue slug (no foreign key) and the web resolves it against its own list.

All routes sit under `/api/me/saved`: Origin check, security headers, `requireAuthSecret` (503 `auth_unavailable` without a proper secret) and `requireSession` (401 `unauthorized`) apply. No captcha. Errors are `{ code, message, ...extra }`. Times are unix seconds. The user always comes from the session, so a learner can only ever read or change their own rows.

## Endpoints

- `GET /api/me/saved` -> 200 `{ saved: [{ resourceId, savedAt }] }`, newest first (ties: latest save first), max 500.
- `PUT /api/me/saved/{resourceId}` -> 200 `{ saved: { resourceId, savedAt } }`. Idempotent: saving again keeps the original `savedAt`.
- `DELETE /api/me/saved/{resourceId}` -> 200 `{ removed: true }`. Idempotent: also 200 when it was not saved.

`resourceId` must match `^[a-z0-9][a-z0-9-]{0,63}$`.

## Error codes

| Status | code | When |
| --- | --- | --- |
| 400 | `invalid_request` | `resourceId` does not match the pattern |
| 401 | `unauthorized` | no session |
| 409 | `saved_limit` | already 500 saved and this id is new (re-saving an existing id still works) |
| 429 | `rate_limited` | 120 changes (PUT or DELETE) per hour per user; `retryAfterSeconds` and `Retry-After`. GET is not limited |
| 503 | `auth_unavailable` | `BETTER_AUTH_SECRET` missing or weak |

Validation runs before the rate limit, so invalid requests do not use it up.

## Data

Migration `migrations/0007_saved_resources.sql`: `saved_resources(user_id, resource_id, created_at)`, primary key `(user_id, resource_id)`, index `(user_id, created_at DESC)`. `user_id` references `user(id) ON DELETE CASCADE`, so `DELETE /api/me` removes the learner's rows (tested). The cap and the insert are one atomic statement. Audit events `saved.added` and `saved.removed` (only when a row actually changed) hold the actor and the catalogue id, nothing else.
