# Learner authentication

Better Auth 1.7.18 on the `matr-api` Worker, mounted at `/api/auth`, D1 storage. The binding spec is
`docs/SECURITY-AUTH.md`. The site reaches the API same-origin as `https://matrstudio.com/api/*`
(service binding), so the cookie is host-only on `matrstudio.com`.

## Secrets and settings the owner must set

Set with `wrangler secret put <NAME>` per environment. Never commit them.

| Name | Needed | Notes |
|---|---|---|
| `BETTER_AUTH_SECRET` | yes | 32+ random bytes: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Signs cookies and email-verification links, and keys the email hashes in the audit log. Rotating it signs everyone out and invalidates pending links. |
| `RESEND_API_KEY` | yes | Existing. Used by the queue consumer only. |
| `TURNSTILE_SECRET` | yes in production | Existing. Without it, captcha-protected routes answer `503 captcha_unavailable` in production (fail closed); in development it is skipped. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional | Google sign-in is switched on only when both exist. Redirect URI to register: `https://matrstudio.com/api/auth/callback/google`. |

Resend dashboard: turn **click tracking and open tracking OFF** for the `matrstudio.com` sending
domain (Domains > matrstudio.com > Configuration). The API has no per-message switch, and a tracked
link would send one-time tokens through a third-party redirect.

Plain vars in `wrangler.toml`: `PUBLIC_WEB_URL` (Better Auth `baseURL`, the passkey origin, and the
only origin emailed links are built on), `ALLOWED_ORIGINS` (CSRF and CORS allow-list; `https://matrstudio.com`
is always added).

Queue: producer binding `AUTH_EMAIL_QUEUE` and the consumer are both in this Worker, on the existing
queue `matr-auth-email` (3 retries, then the audit log records `email.dropped`; no dead-letter queue).

## Run it locally

```
cp .dev.vars.example .dev.vars        # then set BETTER_AUTH_SECRET (the file is git-ignored)
pnpm --filter @matr/backend db:migrate:local
pnpm --filter @matr/backend dev       # http://localhost:8787
pnpm --filter @matr/backend test
```

Without `RESEND_API_KEY` the consumer logs `auth email skipped` and the message type only (read the
link from a test, or set a key). `PASSWORD_SCRYPT_N` and `AUTH_MIN_RESPONSE_MS` lower the hashing cost and
the timing floor; both are ignored when `ENVIRONMENT=production`. Remote migrations are run by CI or the owner,
never from a dev machine.

## Where things live

- `src/auth/index.ts` Better Auth config, rate-limit, captcha, audit and revocation hooks
- `src/auth/session-hash.ts` session-token hashing layer and the 30-day absolute cap
- `src/auth/password.ts` scrypt (`node:crypto`, needs `nodejs_compat`)
- `src/auth/limits.ts` D1 counters; `src/auth/audit.ts` append-only log; `src/auth/turnstile.ts`
- `src/auth/guard.ts` `requireSession` and `can()`; `src/auth/invites.ts` `issueInvite()` (internal)
- `src/routes/me.ts` `/api/me*`; `src/queue/auth-email.ts` producer and consumer
- `src/lib/auth-email-templates.ts` the six emails
- `migrations/0003_auth.sql`, `0004_auth_support.sql`

Issue a waitlist invite (no UI yet): call `issueInvite(env, { email, createdBy })` from a script or a
future admin handler; send the returned `link` (`/invite?token=...`) to the person.

## Link failure codes (for the screens)

| Link | Where the failure shows up | Codes |
|---|---|---|
| Email confirmation `GET /api/auth/verify-email?token&callbackURL` | Redirect to `callbackURL` (`/email-confirmed`) with `?error=` (without a `callbackURL`: 400 JSON `{code}`) | `link_expired` (signature valid, past expiry), `already_confirmed` (signature valid and the token was already used, or the user is already verified), `link_invalid` (bad signature, unknown, anything else) |
| Magic link `GET /api/auth/magic-link/verify` | Redirect to `errorCallbackURL` (default `/sign-in`) with `?error=` | `link_expired` (the record exists and is past its 15 minutes), otherwise `INVALID_TOKEN` (unknown, used, tampered) |
| Password reset `POST /api/auth/reset-password {newPassword, token}` | 400 JSON `{code}` | `link_expired` (valid token, past 15 minutes), `link_invalid` (unknown, used, tampered); password errors keep their `PASSWORD_*` codes |
| Reset page load `GET /api/auth/reset-password/check?token=` | 200 `{status:"ok"\|"expired"\|"invalid"}` | Read-only, never consumes the token. 429 `rate_limited` after 30 per 15 minutes per IP |

Only a caller who holds a link we issued can learn its state: confirmation links are signed (a forged
or foreign token is always `link_invalid`), and reset/magic tokens are random, so `invalid` covers both
"never existed" and "already used". Nothing here says whether an email address has an account.
Expired single-use records are kept for a day (cron purge) so "expired" can be told from "unknown".
