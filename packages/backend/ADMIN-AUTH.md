# Admin authentication

Implements `docs/SECURITY-AUTH.md` section 6 (two locks), 3, 4, 5, 7, 8, 12 for the admin portal. All
routes are under `/api/admin/**` on the same Worker. The admin app reaches them same-origin as
`https://admin.matrstudio.com/api/*` (service binding, like the learner site), so the cookie is
host-only on `admin.matrstudio.com`.

Admin auth is hand-built from small audited modules rather than a second Better Auth instance: a
separate table and cookie per audience is the point (a learner session can never authorise an admin
route), and TOTP is about 100 lines of WebCrypto tested against the RFC 6238 vectors. Password
hashing (scrypt), session-token hashing, the D1 rate counters and the audit log are the learner ones.

## The two locks

1. **Cloudflare Access** (`src/auth/access.ts`, middleware `requireAccess`): every `/api/admin/**`
   request must carry a valid Access JWT (`Cf-Access-Jwt-Assertion`, else the `CF_Authorization`
   cookie). Verified: RS256 signature against `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`
   (cached 1 hour in memory; an unknown `kid` refetches at most once a minute), `iss`, `aud`, `exp`, `nbf`
   (30 s skew), and a non-empty `email`. The verified email is the Access identity.
   - Rejection: `403 access_denied` (one answer for every reason). Not configured or keys unreachable:
     `503 admin_unavailable` (fail closed, also in development).
   - Dev bypass: only when `ENVIRONMENT` is exactly `development` AND `ADMIN_DEV_BYPASS_ACCESS=true`;
     the identity then comes from the `X-Dev-Access-Email` header. Any other `ENVIRONMENT` value
     (production, unset, staging) can never use it (tested).
2. **Admin session** (`src/auth/admin-session.ts`, `admin-guard.ts`): cookie `__Host-ms_admin_session`
   (`HttpOnly; Secure; SameSite=Lax; Path=/`, no `Domain`), token = 32 random bytes, stored as
   `sha256:<hex>` in `admin_sessions`. Idle 30 minutes (sliding, pushed forward at most once a minute),
   absolute 12 hours. On EVERY request the Access email must equal the admin account's email, so a stolen
   cookie does not work from another Access identity.

Sign-in is email + password (scrypt, 12+ chars, breached-password check at set time), then a mandatory
second step: a 6-digit authenticator code (RFC 6238, SHA-1, 30 s, window of plus or minus 1 step; the used
time-step is stored and never accepted again) or a one-time backup code (10 per admin, keyed hashes, single use).
TOTP secrets are AES-GCM encrypted (HKDF key from `ADMIN_TOTP_KEY`, else `BETTER_AUTH_SECRET`; the admin id is
authenticated data). The password step issues a 10 minute `mfa_pending` session that authorises only
`POST /sign-in/mfa`; on a good code it is replaced by a new full session (rotation).

## Secrets and vars to set (owner)

| Name | Kind | Notes |
|---|---|---|
| `CF_ACCESS_TEAM_DOMAIN` | var or secret | `matrstudio` or `matrstudio.cloudflareaccess.com` (must be a `*.cloudflareaccess.com` host) |
| `CF_ACCESS_AUD` | secret | the Access application AUD tag |
| `ADMIN_BOOTSTRAP_EMAIL` | secret | first super admin; delete it after the first sign-in |
| `ADMIN_TOTP_KEY` | secret, optional | 32+ random bytes; encrypts TOTP secrets. If unset, `BETTER_AUTH_SECRET` is used. Rotating either one breaks stored TOTP secrets (admins would need an MFA reset), so choose before launch. |
| `PUBLIC_ADMIN_URL` | var | in `wrangler.toml`, default `https://admin.matrstudio.com`; the only base for emailed admin links and the only origin `/api/admin/**` accepts (plus localhost origins from `ALLOWED_ORIGINS` when `ENVIRONMENT=development`) |
| `ADMIN_DEV_BYPASS_ACCESS` | dev var only | never set it outside `.dev.vars` |

Set with `wrangler secret put <NAME>` per environment; never commit them. Not done by this work.
Apply migration `0005_admin_auth.sql` with the normal flow (CI or the owner, never from a dev machine).

## Cloudflare Access setup (Zero Trust dashboard)

1. Zero Trust > Settings > Authentication: note the **team name** (the `<team>` in `<team>.cloudflareaccess.com`) and enable at least one identity provider with MFA (or one-time PIN as a minimum).
2. Access > Applications > Add > Self-hosted. Application domain: `admin.matrstudio.com` (whole host, so the app and `/api/*` are both covered). Session duration: 12 hours or less (the in-app session is 12 hours absolute, 30 minutes idle).
3. Policy: Action **Allow**, Include **Emails** (the allow-list of admin identities; each must equal the email on the matching admin account), Require **Authentication method: MFA** if your IdP supports it. Add a final implicit deny (default).
4. Save, open the application, copy the **Application Audience (AUD) Tag**: that is `CF_ACCESS_AUD`.
5. Set `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`, then deploy. Until both are set the admin API answers `503`.
6. Admins are not required to use a work email. The Access allow-list entry and the admin account email must match exactly (case-insensitive).

## Creating the first super admin

No default account exists and no password is stored anywhere.
1. Add the owner's email to the Access allow-list.
2. `wrangler secret put ADMIN_BOOTSTRAP_EMAIL` (the same email).
3. The Worker's 30-minute cron tick calls `bootstrapSuperAdmin(env)` (`src/auth/admin-invites.ts`): it
   issues a `super_admin` invite and emails it (queue, Resend). Locally: `pnpm --filter @matr/backend dev`
   then `curl "http://localhost:8787/__scheduled?cron=*/30+*+*+*+*"`; without `RESEND_API_KEY` the email
   is only logged by type, so read the link from a test or temporarily set a key.
4. Open the link on `PUBLIC_ADMIN_URL`, set a password, scan the QR code, save the backup codes.
5. Delete the secret. It is idempotent: `exists` once any super admin exists, `pending` while a live invite
   exists (no repeat emails), and a lost or expired invite is replaced on the next tick.

Internal functions (no UI yet), all audited, all revoking sessions where the spec says so:
`issueAdminInvite`, `cancelAdminInvite`, `resetAdminMfa` (`admin-invites.ts`); `createCustomRole`,
`changeAdminRole`, `suspendAdmin`, `revokeAdminSessions` (`admin-perms.ts`); `unlockAdmin`
(`admin-lock.ts`, the "ask a Super admin to unlock it" action).

## API contract

Every call needs a valid Access identity (header or cookie added by Access; same-origin through the admin
Worker) and, on POST/PUT/PATCH/DELETE, `Origin: https://admin.matrstudio.com`. Bodies are JSON, strict (unknown
fields are `400 invalid_request`). Errors are `{ code, message, ...extra }`. Types: `@matr/types` (`Admin*`).

Common: `403 access_denied` (Access), `503 admin_unavailable` (Access not configured), `401 unauthorized` (no or
expired admin session: send to sign-in), `403 forbidden` (session fine, role lacks the permission), `401
reauth_required` (needs step-up), `400 invalid_request`, `429 too_many_attempts {retryAfterSeconds}`.

| Endpoint | Body | Success | Errors and screens |
|---|---|---|---|
| `POST /api/admin/sign-in` | `{email, password}` | `200 {status:"mfa_required"}` + pending cookie | `401 invalid_credentials` = "wrong details" screen (wrong email, password, Access identity, inactive account all look the same). `429 too_many_attempts` = "sign-in paused" (show "Try again at" now + `retryAfterSeconds`; the owner is emailed once; "Contact a Super admin" can unlock via `unlockAdmin`). |
| `POST /api/admin/sign-in/mfa` | `{code}` 6-digit or backup code `xxxxx-xxxxx` | `200 {admin: AdminMeResponse, backupCodesRemaining}` + full session cookie | `401 invalid_code` = "wrong code" screen. `429 too_many_attempts` = paused (5 wrong codes per 15 min; from the 3rd wrong code a 5/10/20 s delay answers 429 with a short `retryAfterSeconds`; at the 5th the pending session is ended, go back to sign-in). `401 unauthorized` = no pending session, back to sign-in. |
| `POST /api/admin/sign-out` | `{}` | `200 {ok:true}`, cookie cleared | none |
| `GET /api/admin/me` | | `200 AdminMeResponse` `{id,email,name,role:{id,name},permissions,menu,mfaEnrolled,lastReauthAt,fresh,sessionExpiresAt,sessionAbsoluteExpiresAt}`; `menu` is the areas with permission above none, in side-menu order | `401 unauthorized` |
| `POST /api/admin/reauth` | `{password, code}` | `200 {lastReauthAt}` | `401 reauth_failed`; `429 too_many_attempts` (also ends the session). A code already used to sign in is refused: wait for the next 30 s code or use a backup code. |
| `POST /api/admin/password` | `{currentPassword, newPassword}` (needs fresh step-up) | `200 {ok:true}`; ALL sessions deleted, cookie cleared | `401 reauth_required`, `401 reauth_failed`, `400 password_too_short \| password_too_long \| password_compromised` |
| `GET /api/admin/invite/check?token=` | | `200 {status:"ok", emailHint, role, expiresAt}` | `400 invite_invalid` (unknown, used, tampered, wrong Access identity) = generic invalid screen; `400 invite_expired` / `invite_cancelled` with `{invitedBy: name\|null, invitedAt}` = "This invite has expired" screen (only for a validly signed token). `429` after 30 per 15 min per IP. |
| `POST /api/admin/invite/accept` (step 1, set password) | `{token, password, name?}` | `200 {step:"mfa", otpauthUri, secretKey}`: render `otpauthUri` as the QR code; show `secretKey` ("JBSW Y3DP EHPK 3PXP") under it. Safe to call again (restarts enrolment). | invite codes above; `400 password_too_short \| password_too_long \| password_compromised` |
| `POST /api/admin/invite/enrol` (step 2 + 3) | `{token, code}` 6-digit | `200 {admin, backupCodes:[10 strings]}` + session cookie. The backup codes are returned ONCE here (design screen "save backup codes"); the invite is consumed and the account becomes active. | `409 enrolment_not_started` (do step 1 first), `401 invalid_code`, invite codes, `429` |
| `GET /api/admin/team` | | `200 {members:[{id,email,name,roleId,roleName,status,lastSignInAt}]}` | needs View on `admin_team` |
| `POST /api/admin/team/invite` | `{email, roleId, name?}` | `201 {invite:{id,email,roleId,expiresAt}}`, email queued | needs Manage on `admin_team` + step-up: `403 forbidden`, `401 reauth_required`, `404 role_not_found`, `409 admin_exists` |
| `DELETE /api/admin/team/:id` | | `200 {removed:true}`, sessions deleted | same guards; `404 not_found`, `400 cannot_remove_self`, `409 last_super_admin` (defence in depth, unreachable through the API today) |

Design mapping: Admin sign in 587:919 = `sign-in`; wrong details 589:1262 = `invalid_credentials`; paused 589:1743 =
`too_many_attempts`; two-step code 590:1658 = `sign-in/mfa`; wrong code 590:2175 = `invalid_code`; accept invite
steps 591:2583 / 591:3970 / 592:3180 = `invite/accept` then `invite/enrol` (codes in its response); invite expired or
cancelled 592:3683 = `invite_expired` / `invite_cancelled` (with `invitedBy`, `invitedAt`).

Areas (from the Nav frames): `dashboard, metrics, resources, paths, review_queues, users_waitlist, support_inbox,
admin_team, roles, audit_log, settings`. Levels `none | view | manage`. `super_admin` is computed (manage on all, view on
`audit_log`) and cannot be edited. Custom roles are capped at View on `admin_team`, `roles` and `audit_log`
(code, DB triggers, and clamped again on read) and at 20 roles.

## Limits (src/auth/limits.ts)

Sign-in: 5 per 15 min per email and 20 per 15 min per IP (the attempt that uses up the email budget already answers
paused). 2-step code and re-auth share 5 wrong attempts per 15 min per admin, with a 5/10/20 s (cap 60 s) delay from
the 3rd. Invite check/accept/enrol: 30 per 15 min per IP. One "sign-in paused" email per admin per 15 min. Counters are
cleared on a successful sign-in. A paused admin is blocked even with the right password or code until the window ends or
`unlockAdmin` runs.

## Audit

Actions added: `admin.signin.success|failure|access_mismatch|paused`, `admin.mfa.success|failure|enrolled|reset`,
`admin.backup_code.used`, `admin.reauth.success|failure`, `admin.signout`, `admin.session.revoked`,
`admin.invite.created|cancelled|accepted|invalid`, `admin.password.set`, `admin.role.created|assigned`,
`admin.suspended`, `admin.unlocked`, `admin.removed`, `admin.bootstrap`. Actors and targets are admin ids or keyed email
hashes; before/after are role ids or states; never emails, tokens, passwords, codes or secrets (tested).

## Not in this change

Admin UI (apps/*), passkeys, regenerating backup codes after sign-in, roles CRUD routes, a "you were removed" email (the
design has none), and an alert pipeline for admin events. Access-denied attempts are logged to the Worker log only (an
audit row per unauthenticated request would be a write-amplification risk).
