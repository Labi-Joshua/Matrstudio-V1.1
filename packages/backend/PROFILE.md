# Profile and public profile

Shared types and zod schemas live in `packages/types` (`OwnProfile`, `PublicProfile`, `updateProfileSchema`, `usernameSchema`, `RESERVED_USERNAMES`, `AVATAR_MAX_BYTES`, `ProfileErrorBody`). The web app has no dependency on that package, so `apps/web/lib/app/profile-form.ts` mirrors the rules by hand (keep them in step).

Migration `migrations/0011_profiles.sql`: `profiles(user_id PK, username, display_name, bio, avatar BLOB, avatar_type, avatar_updated_at, is_public, show_stats, show_paths, show_submissions, created_at, updated_at)`. `user_id` references `user(id) ON DELETE CASCADE`, so `DELETE /api/me` removes the profile and the photo (tested). Usernames are stored lower-case, with CHECK constraints for length 3..30 and `[a-z0-9_]`, and a unique index, so uniqueness is case-insensitive. Times in these APIs are ISO 8601 strings.

## Authenticated: `/api/me/profile`

Mounted from `routes/me.ts`: Origin check, security headers, `requireAuthSecret` (503 `auth_unavailable`) and `requireSession` (401 `unauthorized`) apply. The learner always comes from the session.

- `GET /api/me/profile` -> `{ profile: { username, displayName, bio, avatarUrl, isPublic, visibility: { stats, paths, submissions }, createdAt, updatedAt } }`. The row is created on first use, private, with a username derived from the account name (never the email), plus four random digits when taken, and `visibility` all on.
- `PATCH /api/me/profile` body (strict, at least one key) `{ displayName? 1..60, username? 3..30 [a-zA-Z0-9_] (lower-cased), bio? <= 200, isPublic?, visibility?: { stats?, paths?, submissions? } }` -> `{ profile }`. Changing `displayName` also updates the account name (`user.name`).
- `GET /api/me/profile/username-check?u=` -> `{ available: true }` or `{ available: false, reason: "invalid" | "reserved" | "taken" }`. Your own username is available. Invalid names are answered before the rate limit is spent.
- `PUT /api/me/profile/avatar`: the body is the image itself (png, jpeg or webp), at most 200 KB (the web app resizes to at most 256 px first). The type comes from the magic bytes, never from `Content-Type`. -> `{ profile }`.
- `DELETE /api/me/profile/avatar` -> `{ profile }` (idempotent).

"Choose what shows" in the design maps to the three flags: learning stats, completed paths, approved submissions. Name, username, photo, bio, level, interests and join month are shown on every public profile. Email, saved items and paths in progress are never returned.

## Public (no session)

- `GET /api/profiles/:username` -> `{ profile: { username, displayName, bio, avatarUrl, level, topics, joinedAt, stats, completedPaths, submissions } }`. `stats`, `completedPaths` and `submissions` are `null` when the owner switched them off. Private, unknown, reserved and malformed usernames all answer **404 with the identical body** `{ code: "not_found", message: "This profile isn't available." }` (the query itself requires `is_public = 1`). `Cache-Control: no-store`. Limited to 120 per 10 minutes per IP (429 `rate_limited`, `Retry-After`).
  - `submissions` are the learner's curator-accepted submissions (newest 20).
  - `stats` is always `null` and `completedPaths` is `[]` for now: path progress has no table in this migration set. When it lands, fill them in `routes/public-profile.ts`, behind the same flags.
- `GET /api/avatars/:userId` serves the stored photo with `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, `Content-Security-Policy: default-src 'none'`. Public profiles: `public, max-age=31536000, immutable` (the URL carries `?v=<avatar_updated_at>`). A private profile's photo is only served to its owner (`private, max-age=3600`); everyone else gets the same 404. Not rate limited (tiny, cacheable read); a photo that was public stays in shared caches until its URL changes.

## Errors

| Status | code | When |
| --- | --- | --- |
| 400 | `invalid_request` | bad field; `fieldErrors` names `displayName`, `username` or `bio` |
| 400 | `username_reserved` | reserved word (admin, support, settings ...), case-insensitive |
| 400 | `avatar_invalid` | not a png, jpeg or webp by magic bytes, or empty |
| 401 | `unauthorized` | no session |
| 409 | `username_taken` | someone else has it, in any case |
| 413 | `avatar_too_large` | over 200 KB (`Content-Length` is checked before the body is read) |
| 429 | `rate_limited` | 30 writes per hour per learner, 60 username checks per 10 minutes, `retryAfterSeconds` |
| 503 | `auth_unavailable` | `BETTER_AUTH_SECRET` missing or weak |

Audit events: `profile.updated` (meta lists field names only), `profile.visibility` (meta `{ public }`), `profile.avatar.set`, `profile.avatar.removed`. No usernames, names, bios or images are logged.
