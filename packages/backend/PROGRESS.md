# Path progress

Learners start learning paths, mark lessons done and star paths. Shared types live in `packages/types` (`PathProgress`, `PathErrorBody`, `PATH_LIMIT`, `pathIdSchema`, `lessonDoneSchema`). The catalogue is not in the database, so `slug` and `lessonId` are catalogue ids (no foreign key) and the client sends the lesson count (`total`) when it marks a lesson done. Progress is self-reported and only ever affects the learner's own rows.

All routes sit under `/api/me/paths`: Origin check, security headers, `requireAuthSecret` (503 `auth_unavailable`) and `requireSession` (401 `unauthorized`) apply. No captcha. Errors are `{ code, message, ...extra }`. **Times are ISO 8601 strings** (unlike the older submissions and saved APIs, which use unix seconds). The user always comes from the session.

`PathProgress`: `{ slug, startedAt, lastActivityAt, completedAt, starredAt: ISO | null, completedLessonIds: string[] }`. `completedLessonIds` are ordered by when each lesson was done.

## Endpoints

- `GET /api/me/paths` -> `{ paths: PathProgress[] }`: paths that are started or starred, most recent activity first (`lastActivityAt`, else `starredAt`), max 200.
- `POST /api/me/paths/{slug}/start` -> `{ path }`. Idempotent; keeps the original `startedAt`.
- `PUT /api/me/paths/{slug}/lessons/{lessonId}` body `{ total: 1..200 }` -> `{ path }`. Marks the lesson done, starts the path if needed and sets `completedAt` once done lessons reach `total`. The completion time is set once and never moved by a repeat call.
- `DELETE /api/me/paths/{slug}/lessons/{lessonId}` -> `{ path }`. Undo: removes the lesson and clears `completedAt`. Idempotent; creates no enrolment (an unknown path answers an empty `PathProgress`).
- `PUT /api/me/paths/{slug}/star` -> `{ path }`. Idempotent; a star can exist before a start (`startedAt: null`).
- `DELETE /api/me/paths/{slug}/star` -> `{ path }`. Idempotent. A row that was only ever starred is deleted so it frees a slot.

Ids must match `^[a-z0-9][a-z0-9-]{0,63}$`.

## Error codes

| Status | code | When |
| --- | --- | --- |
| 400 | `invalid_request` | bad slug or lesson id, or `total` missing, not an integer, or outside 1..200 |
| 401 | `unauthorized` | no session |
| 409 | `path_limit` | the learner already follows 200 paths and this slug is new |
| 429 | `rate_limited` | 120 writes per hour per user; `retryAfterSeconds` and `Retry-After`. GET is not limited |
| 503 | `auth_unavailable` | `BETTER_AUTH_SECRET` missing or weak |

Validation runs before the rate limit, so invalid requests do not use it up.

## Data

Migration `migrations/0008_path_progress.sql`: `path_enrolments(user_id, path_slug, started_at, last_activity_at, completed_at, starred_at)` and `path_lessons_done(user_id, path_slug, lesson_id, completed_at)`, both keyed by user and ids, both `ON DELETE CASCADE` on the user (tested with `DELETE /api/me`). The 200-path cap is one atomic insert. Audit events `path.started`, `path.lesson_done`, `path.lesson_undone`, `path.completed`, `path.starred`, `path.unstarred` (only when a row really changed; actor and `slug` or `slug/lessonId`, nothing else).
