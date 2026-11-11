# Settings API

Everything the Settings screens need. Same rules as the rest of `/api/me/*`: JSON, session cookie, Origin check, errors
are `{ code, message, ...extra }`, times are ISO 8601 strings, `429 rate_limited` carries `retryAfterSeconds` and a
`Retry-After` header. Routes are in `src/routes/account.ts` and `src/routes/prefs.ts`, mounted by `src/routes/me.ts`.
Shared types and zod schemas: `packages/types/src/settings.ts`. Tests: `test/settings.test.ts`.

## What already existed (not rebuilt)

| Need | Where |
|---|---|
| Sessions list, revoke one, sign out everywhere | `GET /api/me/sessions`, `POST /api/me/sessions/revoke`, `POST /api/me/sessions/revoke-others`, `POST /api/auth/revoke-sessions` |
| Change password (revokes the other sessions, emails the address) | Better Auth `POST /api/auth/change-password {currentPassword, newPassword}` |
| Goal, level, topics | `POST /api/me/onboarding` (partial, idempotent), read from `GET /api/me` |
| Name | Better Auth `POST /api/auth/update-user {name}` |
| Link Google | Better Auth `POST /api/auth/link-social {provider:"google", callbackURL}` |
| Passkeys | `@better-auth/passkey` endpoints; `passkeyCount` in `/api/me` |

The settings screens in the design do not show a sessions list, a name field or passkeys, so the web app does not use those yet.

## Added

### `GET /api/me/prefs` and `PATCH /api/me/prefs`

Table `user_preferences` (migration `0012`): one row per learner, created on first save; no row means the defaults
(`DEFAULT_PREFS`). Cascades on user delete.

```
{ prefs: {
    notifications: { submissions, lessons, helpReplies: boolean },   // in the app, under the bell
    email:         { digest, reminders, news: boolean },             // by email
    reminders:     { days: ("mon"|...|"sun")[], time: "HH:MM" },     // days in week order, no duplicates
    learning:      { weeklyGoal: 1..14 }                             // lessons per week
} }
```

`PATCH` takes any subset (at least one field; unknown keys, wrong types and out-of-range values are `400 invalid_request`),
changes only what was sent, and answers with the full `prefs`. Write limit 120/hour/learner.
The goal, level and topics of the learning screen are read from `/api/me` and saved with `POST /api/me/onboarding`.
Privacy ("Public profile") is `GET/PATCH /api/me/profile {isPublic}` (see `PROFILE.md`).

These switches are stored now; the notification, digest and reminder jobs that read them are separate work.

### `GET /api/me/account`

`{ account: { hasPassword, google: { linked }, passkeyCount, pendingEmail: { email, requestedAt, expiresAt } | null, counts: { saved, submissions } } }`.
`counts` feed the "You'll lose" line of the delete dialog. A pending change older than 24 hours is reported as `null`.

### Email change

Confirmation goes to the NEW address, through the existing Better Auth change-email flow, token machinery and email queue
(signed link, single use, 24 hours). Opening the link changes the address, revokes every session and emails the OLD address
(`email-changed`, with the masked new address). Raw `POST /api/auth/change-email` is disabled so none of the checks below can
be skipped.

- `POST /api/me/account/email {newEmail, password?}` -> `{ pendingEmail }`. Needs re-authentication: a session created in the
  last 5 minutes, or the current `password` (`401 reauth_required`). `400 same_email` for the current address. Limits: 3/hour
  per learner, 10/hour per network, wrong passwords 5 per 15 minutes. When the address already belongs to someone the answer is
  identical and nothing is sent (no way to find out who has an account).
- `POST /api/me/account/email/resend` -> `{ pendingEmail }`; `404 not_found` when nothing is pending. Shares the 3/hour limit.
- `DELETE /api/me/account/email` -> `{ cancelled: true }`. Deletes the pending row, which kills every outstanding link: the
  verify hook (`auth/index.ts`) only accepts an email-change token while `pending_email_changes` still names that address.

The link lands on `callbackURL=/settings/confirm-email` (relative paths only), with `?error=link_expired | link_invalid |
already_confirmed` on failure, like the other email links (see `AUTH.md`).

### `POST /api/me/account/password {newPassword}`

Only for accounts without a password (Google-only). Needs a session created in the last 5 minutes (`401 reauth_required`;
the learner signs in again). 12 to 128 characters, breach check like the other password routes (`PASSWORD_COMPROMISED`),
`409 password_exists` when there is one already. Revokes the other sessions and emails `password-updated`. Limit 20/hour.

### `DELETE /api/me/account/google`

Unlinks Google. `409 last_sign_in_method` when it is the only way in (no password, no passkey); fresh session or a password
on the account required. Limit 20/hour.

### `GET /api/me/account/export`

The learner's own data as a JSON download (`Content-Disposition: attachment`): account (id, name, email), onboarding,
preferences, saved and submissions. No password hash, token or session rows. 5/hour.

### `DELETE /api/me/account` (also `DELETE /api/me`)

Re-authentication required (docs/SECURITY-AUTH.md section 11): a session created in the last 5 minutes, or `{ password }` in the
body (`401 reauth_required`; wrong passwords are counted, 5 per 15 minutes, then `429`). Deletes the learner and cascades:
sessions, accounts, passkeys, onboarding, preferences, pending email change, saved resources, submissions, magic-link records and
invites for the address. Audit rows keep their action and time but lose actor, target, IP and agent; one `account.deleted`
event with no personal data is written. The session cookie is cleared.

## Audit events (no personal data)

`email.change_requested` (target is the keyed hash of the new address), `email.change_cancelled`, `password.set`,
`account.google_unlinked`, `prefs.updated`, `account.exported`, `account.deleted`, and `rate_limit.hit` with a `scope`.

## Migration

`migrations/0012_user_preferences.sql` creates `user_preferences` and `pending_email_changes`. Backward compatible. CI applies it;
never apply it to a remote database by hand.
