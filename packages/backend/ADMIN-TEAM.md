# Admin team, roles, audit and shell

Everything is under `/api/admin`, behind Cloudflare Access (lock 1) and the admin session (lock 2). Errors are `{ code, message, ...extra }`. Times in the new responses are ISO strings (the older `lastSignInAt` on team members stays unix seconds). Migration `0013_admin_team_roles.sql`. Shared types and zod schemas: `packages/types/src/admin-team.ts`.

"Fresh" = `requireFreshAuth` (re-auth within 300 s, else 401 `reauth_required`). Every write below is audited (actor, target, before/after in meta, truncated IP, user agent) and `confirmed: "password_2step"` is recorded when a fresh step-up gated it.

## Admin team (`admin_team`, writes need `manage` + fresh)

| Method and path | Notes |
| --- | --- |
| `GET /team` | `{ members[], pendingInvites[], onlySuperAdmin }`. Members (active or suspended) carry `mfaEnrolled`, `sessions` (live count), `accessExpiresAt`, `accessExpired`, `isYou`. Invited-but-not-joined people are only in `pendingInvites`. |
| `GET /team/invites` | `{ invites[] }` (live, unused, uncancelled; `expired` flags lapsed ones). |
| `POST /team/invites/:id/cancel` | 409 `invite_not_pending` if already used, cancelled or unknown. |
| `POST /team/invites/:id/resend` | Issues a new 72 h invite that replaces the old one. Rate limit 10/hour/admin. |
| `GET /team/:id` | `{ member }`: role, `invitedBy`, `invitedAt`, `joinedAt`, `mfaEnrolledAt`, `foundingSuperAdmin`, `sessions[]` (device, truncated ip, `current`). |
| `PUT /team/:id/roles` | `{ roleIds: [one], twoStepCode? }`. One role per admin: `roleIds` must have exactly one item. `super_admin` needs `twoStepCode` (the acting admin's current authenticator or backup code): 400 `two_step_required`, 401 `invalid_code`, 429 on the shared 2-step budget. Signs the person out everywhere (existing privilege-change rule), so "applies on next page load" in the design is really "next sign-in". |
| `POST /team/:id/temporary-access` | `{ until: ISO date or date-time | null }`. A bare date means end of that day UTC. Future, at most 366 days (400 `invalid_until`). `null` makes access permanent. |
| `POST /team/:id/suspend` | `{ reason? }` (max 200 chars, stored in the audit meta). 409 `already_suspended`. |
| `POST /team/:id/restore` | 409 `not_suspended`. |
| `POST /team/:id/sign-out-everywhere` | `{ signedOut: n }`. |
| `POST /team/:id/unlock` | Clears the sign-in and 2-step counters. |
| `POST /team/invite`, `DELETE /team/:id` | Unchanged in `routes/admin.ts`. Remove now also cancels the invites that admin sent. |

Common errors: 400 `cannot_change_self` (any write on your own account), 404 `not_found`, 409 `invite_pending` (target has not finished joining), 409 `last_super_admin` (demote, suspend or put an end date on the only active Super admin), 404 `role_not_found`.

### Temporary access

`admin_users.access_expires_at` (unix seconds, NULL = permanent). Enforced where the admin session is validated (`loadAdminSession`: an expired admin has no session, whatever the cookie) and at sign-in (same answer as any bad credential). The cron tick (`cron/admin-access.ts`, every scheduled run) sends one bell notice 3 days before (`area: admin_team`) and, at the end, deletes the sessions and writes `admin.access.expired`. `GET /me` returns `accessExpiresAt`. Emails ("we'll remind you and Seyi") are not sent: only the in-app notice.

## Roles (`roles`: view to read, manage to write; only the Super admin can hold manage)

| Method and path | Notes |
| --- | --- |
| `GET /roles` | `{ roles[], customCount, customLimit: 20 }`. Each role: `id, name, description, builtIn, members, permissions` (all 11 areas). `members` counts every admin account on the role, pending ones included. |
| `GET /roles/:id` | `{ role }` + `memberList[]` (max 100). |
| `POST /roles` | `{ name, description?, permissions }` -> 201. Omitted areas are `none`. |
| `PUT /roles/:id` | `{ name?, description?, permissions? }`; omitted areas keep their level. `?preview=1` writes nothing and returns `{ preview: { changes[{area,from,to}], nameChanged, affected[], affectedCount } }` (no step-up needed). The real save needs fresh step-up and returns `{ role, changes, affectedCount }`. Permissions are read per request, so it applies to members immediately. |
| `POST /roles/:id/duplicate` | `{ name? }` (default "X copy", then "X copy 2"...). Copy of a built-in is clamped to custom ceilings. 201. |
| `DELETE /roles/:id` | `{ moveMembersTo? }`, fresh. 409 `role_has_members` (`members`) without a target; the target cannot be the role itself, unknown, or `super_admin` (400 `move_target_invalid`: promote through the team route so the 2-step code is asked). |

Errors: 400 `level_not_allowed` (ceilings: Admin team and Roles max view, Audit log view only) or `invalid_request` (unknown area), 403 `role_builtin`, 409 `role_name_taken` (case-insensitive, built-in names included), 409 `role_limit` (20 custom). Built-ins: Super admin (computed), Curator and Support (seeded in 0013 with the spec E permissions; Curator has no `settings`, Home curation rides on `resources:manage`; Support has `users_waitlist` manage). They are `is_system = 1`: they do not count towards the cap, and triggers refuse any edit or delete.

## Audit log (`audit_log:view`, read only)

- `GET /audit?q&actor&action&from&to&cursor&limit` -> `{ entries[], nextCursor }`, newest first, 50 per page (max 100). `action` matches exactly or as a prefix (`admin.role` matches `admin.role.updated`). `from`/`to` take a date or date-time; a bare `to` date covers that day. `q` matches action, target, actor name and target name. Only admin events are listed (`admin.*` plus anything done by an admin account); learner events never appear.
- Entry: `{ id, at, actor{id,name,role}|null, action, target, targetLabel, before, after, confirmedWith, device, ip, detail }`.
- `GET /audit/:id` -> `{ entry }`. `GET /audit/export` -> CSV (same filters, max 5000 rows, formula-safe cells, 10 exports/hour/admin); the export itself is audited as `admin.audit.exported`.
- No route writes, edits or deletes; the table's triggers refuse it as well.

## Shell

- `GET /search?q=` (min 2 chars, 120/min/admin) -> `{ users, resources, paths, submissions }`, 5 each, only for areas the admin can view (`users_waitlist`, `resources`, `paths`, `review_queues`). Users and submissions come from existing tables. Resources and paths read tables from migration 0014: the code checks the table and the `id`/`title` columns exist and skips it otherwise. Pointing at the real table or column names is a one-line edit in `TABLE_SOURCES` in `routes/admin-shell.ts`.
- `GET /notifications` -> `{ notifications[{id,kind,title,body,href,createdAt,read}], unread }` (latest 30, filtered by each notification's `area`). `POST /notifications/read-all`. Other builders add entries with `createAdminNotification` (`src/notifications/admin.ts`). Table `admin_notifications`; read state is a per-admin high-water mark (`admin_users.notifications_read_id`).
- `GET /me` additions: `accessExpiresAt`, `badges: { review }` (resource submissions `in_review`; 0 without `review_queues:view`), `unreadNotifications`.

## Data

Migration 0013: `admin_users.access_expires_at`, `access_notice`, `notifications_read_id`; `admin_roles.description`; seeded `curator` and `support` roles; triggers locking system roles; `admin_notifications`.
