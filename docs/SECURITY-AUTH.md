# Matr Studio — Authentication and Security on Cloudflare

> This is the security spec for auth across the learner app, the admin portal and the marketing site.
> AI agents and developers must follow it. If a rule here conflicts with a convenience, the rule wins.
> Read it together with `AGENTS.md`.
>
> Decisions made while building (2026-11-07), where this spec was extended or deliberately differs:
> - Learner sign-in is **email + password plus magic link**, with **Google sign-in** and passkeys offered
>   after the first sign-in (the Figma designs include password and Google flows).
> - Account creation is **open**, with waitlist invite links as a variant (not invite-only).
> - Password hashing uses **scrypt through `node:crypto`**: WebCrypto PBKDF2 is capped at 100,000
>   iterations on Workers, below the OWASP figure.
> - Sign-up shows an "email already registered" state (the Figma design); the no-enumeration rule
>   below still applies to sign-in, magic link and password reset.

---

## 0. Core principles

1. **Don't roll your own auth.** Use a maintained auth library for sessions, tokens, passkeys and 2FA. Most breaches come from hand-written auth logic.
2. **Deny by default.** Every request is unauthenticated and unauthorised until proven otherwise, on the server.
3. **Never trust the client.** Roles, user IDs and permissions sent from the browser are ignored. The server looks them up.
4. **Secrets never touch the repo.**
5. **Log events, never secrets.**

---

## 1. Stack

| Concern | Choice |
|---|---|
| Auth library | **Better Auth** (or an equivalent maintained library that runs on Workers). Confirm the current version and Workers + D1 support before starting. |
| Runtime | Cloudflare Workers (Hono) |
| Users, sessions, tokens | **D1** via Drizzle |
| Bot protection | **Turnstile** |
| Rate limiting | Workers **Rate Limiting** binding and/or WAF rate-limiting rules |
| Admin perimeter | **Cloudflare Access** (Zero Trust) on `admin.matrstudio.com` |
| Secrets | `wrangler secret` (per environment) |
| Email | Sent from a **Queue** consumer, never inline in a request |

---

## 2. Sign-in methods (learners)

**Default: passwordless.**
- **Email magic link:** this matches the product rule that emails use links, not codes.
- **Passkeys (WebAuthn):** offer one after the first sign-in.

**Optional: password**, only if we decide to support it.
- Hash with a slow, salted algorithm provided by the auth library (Argon2id, scrypt, or PBKDF2-SHA256 at OWASP-recommended iterations). Never use plain SHA or MD5.
- Minimum 12 characters. Check new passwords against known-breached lists (k-anonymity API).
- Never log passwords, and never send them back in a response.

**Account creation is invite-only (waitlist):**
- An invite token is single-use, expires in **72 hours**, and is bound to the invited email address.
- Accepting an invite confirms that email.

---

## 3. Sessions

| Rule | Value |
|---|---|
| Storage | **D1**, not KV. KV is eventually consistent, so sign-outs and bans would lag. |
| Token | At least 32 random bytes from `crypto.getRandomValues`. The **cookie** holds the token; the **DB** stores only a **SHA-256 hash** of it. |
| Cookie name | `__Host-ms_session` |
| Cookie flags | `HttpOnly; Secure; SameSite=Lax; Path=/` (no `Domain` attribute) |
| Idle timeout | 7 days (learners), 30 minutes (admins) |
| Absolute lifetime | 30 days (learners), 12 hours (admins) |
| Rotation | A new session ID on sign-in, privilege or role change, and re-authentication |
| Revocation | On sign-out, password or email change, admin suspension, or role removal: delete the session rows immediately |
| Storage in browser | **Never** localStorage or sessionStorage. No JWTs in JS-readable storage. |

Users can see their active sessions (device, location, last seen) and sign out of all of them from Settings.

---

## 4. Email links and tokens

| Token | Lifetime | Uses |
|---|---|---|
| Magic sign-in link | 15 minutes | Single |
| Email confirmation | 24 hours | Single |
| Password reset (if passwords exist) | 15 minutes | Single |
| Waitlist or admin invite | 72 hours | Single |
| Email change confirmation | 24 hours | Single, sent to the **new** address |

- Store **hashed** tokens only. Compare them in constant time.
- Mark a token as used **before** acting on it, in one transaction.
- **After a password reset or email change:**
  - Revoke all sessions.
  - Email the **old** address with a "this wasn't me" link.
- Links point only to `https://matrstudio.com/...`. Never build a link from a user-supplied URL; that would be an open redirect.

---

## 5. Brute force, bots and enumeration

- **Rate limits** (tune after launch):
  - Sign-in and magic-link requests: 5 per 15 minutes per email, and 20 per 15 minutes per IP.
  - Password reset: 3 per hour per email.
  - Waitlist and sign-up: 10 per hour per IP.
  - Submit a resource and contact forms: 10 per hour per user or IP.
- **Turnstile** goes on the waitlist, sign-up, password reset, contact support, report a problem and submit forms. Add it to sign-in after 3 failed attempts.
- **No account enumeration:**
  - Sign-in, magic link and reset always respond: *"If an account exists for that email, we've sent a link."*
  - Keep response timing consistent whether or not the account exists.
- **Lockout:** use progressive delays instead of hard locks, so attackers can't lock real users out.

---

## 6. Admin portal (two locks)

1. **Perimeter:** put `admin.matrstudio.com` behind **Cloudflare Access**.
   - Require SSO with MFA, and allow-list approved admin identities.
   - The Worker validates the Access JWT (`Cf-Access-Jwt-Assertion`) on every request. Never rely on the header just being present.
2. **In-app:**
   - The admin must also have a valid Matr Studio admin session.
   - **Mandatory MFA:** a passkey, or TOTP as a fallback.
   - **Re-authenticate (step-up)** within the last 5 minutes before:
     - Changing roles or permissions
     - Adding or removing admins
     - Changing Settings
     - Deleting paths or resources in bulk
3. **Roles:** permissions per area are `none`, `view` or `manage`.
   - Custom roles are capped at **View** on Admin team and Roles. Only Super admin can Manage those areas.
   - There can be at most 20 custom roles.
4. **Audit log:** every admin write records the actor, action, target, before and after, IP, and time. The log is append-only, and no role can edit or delete it.
5. Admins are **not** required to use a work email (product rule). Security comes from MFA and Access, not from the email domain.

---

## 7. Authorisation (every request)

- Use one server-side helper, `can(user, area, level)`, in middleware. Handlers fail closed.
- **Object-level checks:** confirm ownership or permission on every record. This stops a user from opening someone else's submission, ticket or profile by changing an ID.
- **Public profiles** expose only the fields the user opted to share.
- Validate every input and output with **zod**, and strip unknown fields.

---

## 8. Web security

- **CSRF:**
  - Session cookies use `SameSite=Lax`.
  - All state-changing requests (POST, PUT, PATCH, DELETE) must check the `Origin` header against an allow-list.
  - GET requests never change state.
- **Security headers** on every response:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Content-Security-Policy`: strict, with nonces for scripts, `frame-ancestors 'none'`, and no `unsafe-inline` for scripts
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` disables unused features (camera, microphone, geolocation)
- **CORS:** list allowed origins explicitly (`matrstudio.com`, `admin.matrstudio.com`). Never combine `*` with credentials.
- **SQL:** only Drizzle and D1 parameterised queries. Never build SQL with string concatenation.
- **XSS:**
  - Escape all user content.
  - Resource titles, notes and submissions are plain text, never rendered as HTML.
  - Show external links with `rel="noopener noreferrer"`.
- **Uploads** (report screenshots, avatars) go to R2:
  - Check the file type by magic bytes, not by extension.
  - Enforce a size limit.
  - Serve files from a separate domain or path with `Content-Disposition` set, and never execute them.
- **Submitted URLs:** only `https://` is allowed. When the Worker fetches a submitted URL, for example the broken-link check, block private, internal and metadata IP ranges. This prevents server-side request forgery (SSRF).

---

## 9. Secrets and configuration

- Store secrets with `wrangler secret put` **per environment** (`dev`, `preview`, `production`). They never go in `wrangler.toml`, `.env` files committed to git, or the front-end bundle.
- **Secrets include:**
  - Auth signing keys
  - The email provider key
  - The Turnstile secret
  - The Access audience tag
- **Rotate secrets:** every 90 days, and immediately if one may have leaked.
- **Cloudflare account access:**
  - Turn on MFA.
  - Use least-privilege API tokens. Never use the Global API key.
  - Production deploys run only from CI.
- **Never use production data in `preview` or `dev`.**

---

## 10. Cloudflare platform settings

- **Always Use HTTPS** is on, **minimum TLS is 1.2**, and HSTS is enabled.
- **WAF managed rules** (Cloudflare and OWASP rulesets) are on.
- **Bot protection** is on for the marketing site and the auth routes.
- **Rate-limiting rules** cover `/auth/*`, `/api/submit*` and `/api/support*`.
- **DNSSEC** is enabled for `matrstudio.com`.

---

## 11. Privacy and data handling

- Collect only what each feature needs. This matches the Privacy Policy.
- **Account deletion:**
  - Removes personal data.
  - Anonymises audit log entries where the law allows.
  - Revokes all sessions.
- **Personal data stays out of logs and URLs.** Logs never contain emails, passwords, tokens or full IPs (truncate or hash IPs where possible), and personal data never goes in URL query strings.

---

## 12. Logging, monitoring and response

- **Events to log:**
  - Sign-in success and failure
  - Magic link sent and used
  - Session revoked
  - MFA added or removed
  - Role changed
  - Admin invited or removed
  - Rate limit hit
  - Turnstile failed
- **Alerts** fire on:
  - Spikes in failed sign-ins or resets
  - New admin creation
  - Role escalations
  - Access policy changes
- **Incident playbook:**
  1. Revoke the affected sessions and tokens.
  2. Rotate secrets.
  3. Force re-authentication.
  4. Notify the affected users.
  5. Write a postmortem.

---

## 13. Testing checklist (before launch)

- [ ] Expired, reused and tampered magic links, invites and resets are rejected
- [ ] Sessions are revoked on sign-out, email change, suspension and role removal
- [ ] Cookies have `HttpOnly`, `Secure`, `SameSite=Lax` and the `__Host-` prefix
- [ ] No account enumeration through responses or timing
- [ ] Rate limits and Turnstile trigger as configured
- [ ] Admin routes reject requests without a valid Access JWT, without MFA, or without the right role
- [ ] An IDOR test passes: user A cannot read or modify user B's records
- [ ] CSRF: cross-origin state-changing requests are blocked
- [ ] Every response has the CSP and security headers
- [ ] The SSRF guard blocks internal and metadata IPs on URL fetches
- [ ] No secrets in the repo (secret scanning in CI)
- [ ] Dependencies are up to date (automated updates and an audit in CI)
- [ ] An external security review or penetration test is done before public launch

---

## 14. Open decisions

- [x] Confirm the auth library and version: Better Auth 1.7.x
- [x] Passwords: supported, alongside magic link and passkeys
- [x] Admin MFA: authenticator-app TOTP plus 10 backup codes (the design); passkeys can be added later. See `packages/backend/ADMIN-AUTH.md`.
- [ ] The email provider, which must support link tracking off for auth emails (currently Resend)
- [ ] Final rate-limit numbers after beta traffic
