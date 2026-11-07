import type { AuthContext, BetterAuthOptions, BetterAuthPlugin } from "@better-auth/core";
import { getCurrentAuthEndpointContext } from "@better-auth/core/context";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { isPasswordCompromised } from "better-auth/plugins/haveibeenpwned";
import { magicLink } from "better-auth/plugins/magic-link";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { z } from "zod";
import type { Bindings } from "../env";
import { enqueueAuthEmail } from "../queue/auth-email";
import { writeAudit } from "./audit";
import { CAPTCHA_AFTER_FAILURES, clear, hit, LIMITS, type Limit, peek } from "./limits";
import { hashPassword, SCRYPT_DEFAULTS, verifyPassword } from "./password";
import { hashSessionToken, withHashedSessionTokens } from "./session-hash";
import { verifyTurnstile } from "./turnstile";
import { clientIp, describeDevice, emailRef, sha256Hex, truncateIp } from "./util";

export const SESSION_COOKIE = "__Host-ms_session";
const DAY = 86400;
export const LEARNER_IDLE_SECONDS = 7 * DAY;
export const LEARNER_ABSOLUTE_SECONDS = 30 * DAY;
export const FRESH_AUTH_SECONDS = 300;

/** Stable, lower-case error codes this API adds on top of Better Auth's own (upper-case) codes. */
export const AUTH_ERROR = {
  emailAlreadyRegistered: "email_already_registered",
  emailNotVerified: "email_not_verified",
  tooManyAttempts: "too_many_attempts",
  rateLimited: "rate_limited",
  resendLimit: "resend_limit_reached",
  captchaRequired: "captcha_required",
  captchaFailed: "captcha_failed",
  captchaUnavailable: "captcha_unavailable",
  inviteInvalid: "invite_invalid",
  invalidToken: "invalid_token",
} as const;

export const GENERIC_LINK_MESSAGE = "If an account exists for that email, we've sent a link.";

const PWNED_PATHS = ["/sign-up/email", "/change-password", "/reset-password", "/invite/accept"];

type AuthDeps = { now?: () => Date };

const dbCache = new WeakMap<object, ReturnType<typeof build>>();

/** One Better Auth instance per isolate (keyed by the D1 binding). */
export function getAuth(env: Bindings) {
  let auth = dbCache.get(env.DB);
  if (!auth) {
    auth = build(env);
    dbCache.set(env.DB, auth);
  }
  return auth;
}
export type Auth = ReturnType<typeof getAuth>;

const webOrigin = (env: Bindings) => new URL(env.PUBLIC_WEB_URL).origin;

/** Only same-site relative paths survive; anything else falls back to the default. */
const safePath = (v: string | null, fallback: string) =>
  v && /^\/(?![/\\])[^\s]*$/.test(v) ? v : fallback;

/** Rebuilds a Better Auth link on PUBLIC_WEB_URL, keeping only relative callback paths. */
function safeLink(env: Bindings, url: string, defaults: Record<string, string>): string {
  const src = new URL(url);
  const out = new URL(src.pathname, webOrigin(env));
  const token = src.searchParams.get("token");
  if (token) out.searchParams.set("token", token);
  for (const [k, d] of Object.entries(defaults)) {
    out.searchParams.set(k, safePath(src.searchParams.get(k), d));
  }
  return out.toString();
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    return part ? JSON.parse(atob(part.replaceAll("-", "+").replaceAll("_", "/"))) : null;
  } catch {
    return null;
  }
}

function build(env: Bindings, deps: AuthDeps = {}) {
  const now = deps.now ?? (() => new Date());
  const db = new Kysely<unknown>({ dialect: new D1Dialect({ database: env.DB }) });
  const production = env.ENVIRONMENT === "production";
  const scryptN =
    !production && env.PASSWORD_SCRYPT_N ? Number(env.PASSWORD_SCRYPT_N) : SCRYPT_DEFAULTS.N;
  const scryptParams = { ...SCRYPT_DEFAULTS, N: scryptN };
  const secret = env.BETTER_AUTH_SECRET;
  const web = webOrigin(env);
  const rpID = new URL(env.PUBLIC_WEB_URL).hostname;

  const ref = (email: string) => emailRef(secret, email);
  const ipRef = async (h: Headers) => (await sha256Hex(`${secret}:ip:${clientIp(h)}`)).slice(0, 24);
  const audit = (h: Headers | undefined, e: Parameters<typeof writeAudit>[1]) =>
    writeAudit(env.DB, {
      ip: h ? clientIp(h) : null,
      ua: h?.get("user-agent") ?? null,
      ...e,
    });

  const tooMany = (code: string, message: string, retryAfterSec: number) =>
    new APIError(
      "TOO_MANY_REQUESTS",
      { code, message, retryAfterSeconds: retryAfterSec },
      { "Retry-After": String(retryAfterSec) },
    );

  /** Consumes one hit; on overflow audits and throws 429. */
  async function limit(
    h: Headers,
    key: string,
    rule: Limit,
    code: string,
    message: string,
    scope: string,
  ) {
    const r = await hit(env.DB, key, rule);
    if (!r.allowed) {
      await audit(h, { action: "rate_limit.hit", meta: { scope } });
      throw tooMany(code, message, r.retryAfterSec);
    }
  }

  async function requireCaptcha(h: Headers) {
    const result = await verifyTurnstile(env, h.get("x-captcha-response"), clientIp(h));
    if (result === "ok") return;
    if (result === "unavailable") {
      throw new APIError("SERVICE_UNAVAILABLE", {
        code: AUTH_ERROR.captchaUnavailable,
        message: "We couldn't check that you're human. Try again shortly.",
      });
    }
    const missing = !h.get("x-captcha-response");
    await audit(h, { action: "turnstile.failed", meta: { missing } });
    throw new APIError("BAD_REQUEST", {
      code: missing ? AUTH_ERROR.captchaRequired : AUTH_ERROR.captchaFailed,
      message: missing ? "Complete the captcha to continue." : "Captcha failed. Try again.",
    });
  }

  const authRef: { current?: { $context: Promise<AuthContext> } } = {};
  const context = async () => {
    if (!authRef.current) throw new Error("auth not ready");
    return authRef.current.$context;
  };

  // Better Auth stateless email-verification JWTs are made single-use by recording a hash of each
  // one we send (verification table, identifier hashed by storeIdentifier) and consuming it on use.
  async function registerVerificationToken(token: string, userId: string) {
    const ctx = await context();
    await ctx.internalAdapter.createVerificationValue({
      identifier: `email-verify:${token}`,
      value: userId,
      expiresAt: new Date(now().getTime() + DAY * 1000),
    });
  }

  const passwordPolicyPlugin = {
    id: "pwned-fail-open",
    init(ctx: { password: { hash: (p: string) => Promise<string>; verify: unknown } }) {
      const original = ctx.password.hash;
      return {
        context: {
          password: {
            ...ctx.password,
            async hash(password: string) {
              const c = getCurrentAuthEndpointContext() as { path?: string } | undefined;
              if (!c?.path || !PWNED_PATHS.includes(c.path)) return original(password);
              let compromised = false;
              try {
                compromised = await isPasswordCompromised(password);
              } catch {
                // k-anonymity lookup failed: fail open, but leave a trace.
                console.error("pwned password check unavailable");
                await writeAudit(env.DB, {
                  action: "pwned_check.unavailable",
                  meta: { path: c.path },
                });
              }
              if (compromised) {
                throw new APIError("BAD_REQUEST", {
                  code: "PASSWORD_COMPROMISED",
                  message:
                    "That password has appeared in a data breach. Please choose a different one.",
                });
              }
              return original(password);
            },
          },
        },
      };
    },
  };

  const inviteAcceptPlugin = {
    id: "invite-accept",
    endpoints: {
      acceptInvite: createAuthEndpoint(
        "/invite/accept",
        {
          method: "POST",
          body: z.object({
            token: z.string().min(16).max(256),
            name: z.string().trim().min(1).max(100),
            password: z.string().min(12).max(128),
          }),
        },
        async (ctx) => {
          const { token, name, password } = ctx.body;
          const tokenHash = await sha256Hex(token);
          const invite = await env.DB.prepare(
            "SELECT id, email FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > unixepoch()",
          )
            .bind(tokenHash)
            .first<{ id: string; email: string }>();
          if (!invite) {
            throw new APIError("BAD_REQUEST", {
              code: AUTH_ERROR.inviteInvalid,
              message: "This invite link is invalid or has expired.",
            });
          }
          const existing = await ctx.context.internalAdapter.findUserByEmail(invite.email);
          if (existing?.user) {
            throw new APIError("UNPROCESSABLE_ENTITY", {
              code: AUTH_ERROR.emailAlreadyRegistered,
              message: "An account with this email already exists.",
            });
          }
          const hash = await ctx.context.password.hash(password); // policy and HIBP run here
          // Single use: claim the invite before acting on it.
          const claimed = await env.DB.prepare(
            "UPDATE invites SET used_at = unixepoch() WHERE id = ? AND used_at IS NULL AND expires_at > unixepoch() RETURNING id",
          )
            .bind(invite.id)
            .first();
          if (!claimed) {
            throw new APIError("BAD_REQUEST", {
              code: AUTH_ERROR.inviteInvalid,
              message: "This invite link is invalid or has expired.",
            });
          }
          const user = await ctx.context.internalAdapter.createUser(
            { email: invite.email, name, emailVerified: true },
            { method: "invite" },
          );
          await ctx.context.internalAdapter.linkAccount({
            userId: user.id,
            providerId: "credential",
            accountId: user.id,
            password: hash,
          });
          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          await audit(ctx.headers, {
            actor: user.id,
            action: "invite.accepted",
            target: invite.id,
          });
          return ctx.json({
            token: session.token,
            user: { id: user.id, email: user.email, name: user.name, emailVerified: true },
          });
        },
      ),
    },
  };

  const trustedOrigins = [
    ...new Set([
      web,
      ...env.ALLOWED_ORIGINS.split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    ]),
  ];

  const baseAdapter = kyselyAdapter(db, { type: "sqlite", transaction: false });

  const auth = betterAuth({
    appName: "Matr Studio",
    baseURL: env.PUBLIC_WEB_URL,
    basePath: "/api/auth",
    secret,
    trustedOrigins,
    database: (options: BetterAuthOptions) =>
      withHashedSessionTokens(baseAdapter(options), {
        absoluteMs: LEARNER_ABSOLUTE_SECONDS * 1000,
      }),
    // Our own D1 counters (src/auth/limits.ts) replace Better Auth's limiter.
    rateLimit: { enabled: false },
    // These return raw session rows (token column). /api/me/sessions replaces them; sign-out and
    // revoke-other-sessions stay.
    disabledPaths: ["/list-sessions", "/revoke-session"],
    verification: { storeIdentifier: "hashed" },
    session: {
      expiresIn: LEARNER_IDLE_SECONDS, // idle timeout, slid forward on use
      updateAge: DAY, // slide at most once a day; the absolute 30-day cap is in session-hash.ts
      freshAge: FRESH_AUTH_SECONDS,
    },
    advanced: {
      // Secure is forced through the attributes below so no "__Secure-" prefix is stacked in front
      // of the "__Host-" name.
      useSecureCookies: false,
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      defaultCookieAttributes: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
      cookies: {
        session_token: {
          name: SESSION_COOKIE,
          attributes: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 15 * 60,
      password: {
        hash: (password) => hashPassword(password, scryptParams),
        verify: ({ hash, password }) => verifyPassword(hash, password),
      },
      sendResetPassword: async ({ user, token }) => {
        await enqueueAuthEmail(env, {
          type: "reset-password",
          to: user.email,
          link: `${web}/reset-password?token=${encodeURIComponent(token)}`,
        });
      },
      onPasswordReset: async ({ user }, request) => {
        const h = request?.headers;
        await audit(h, { actor: user.id, action: "password_reset.completed" });
        await enqueueAuthEmail(env, {
          type: "password-updated",
          to: user.email,
          when: now().toUTCString(),
          device: describeDevice(h?.get("user-agent")),
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: DAY,
      sendVerificationEmail: async ({ user, url, token }, request) => {
        const payload = decodeJwtPayload(token);
        const isChange = payload?.requestType === "change-email-verification";
        // Resends triggered by a sign-in attempt share the visible resend limit; the explicit
        // /send-verification-email endpoint is limited in the before hook.
        const path = request ? new URL(request.url).pathname : "";
        if (path.endsWith("/sign-in/email")) {
          const r = await hit(env.DB, `resend:${await ref(user.email)}`, LIMITS.resendEmail);
          if (!r.allowed) return;
        }
        await registerVerificationToken(token, user.id);
        const link = safeLink(env, url, { callbackURL: "/email-confirmed" });
        await enqueueAuthEmail(env, {
          type: isChange ? "confirm-email-change" : "confirm-email",
          to: user.email,
          link,
        });
      },
      afterEmailVerification: async (user, request) => {
        await audit(request?.headers, { actor: user.id, action: "email.verified" });
      },
    },
    user: { changeEmail: { enabled: true } },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {},
    databaseHooks: {
      session: {
        create: {
          before: async (session) => ({
            data: { ...session, ipAddress: truncateIp(session.ipAddress as string | undefined) },
          }),
        },
      },
      user: {
        update: {
          before: async (data, ctx) => {
            if (data.email && ctx?.path === "/verify-email") {
              const payload = decodeJwtPayload(String(ctx.query?.token ?? ""));
              if (payload?.requestType === "change-email-verification") {
                emailChanges.set(String(payload.userId), {
                  oldEmail: String(payload.email),
                  headers: ctx.headers,
                });
              }
            }
            return { data };
          },
          after: async (user) => {
            const change = emailChanges.get(user.id);
            if (!change) return;
            emailChanges.delete(user.id);
            const ctx = await context();
            await ctx.internalAdapter.deleteUserSessions(user.id); // revoke all sessions
            await audit(change.headers, {
              actor: user.id,
              action: "email.changed",
              meta: { sessionsRevoked: true },
            });
            await enqueueAuthEmail(env, {
              type: "email-changed",
              to: change.oldEmail,
              newEmailHint: maskEmail(user.email),
              when: now().toUTCString(),
              device: describeDevice(change.headers?.get("user-agent")),
            });
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const h = ctx.headers ?? new Headers();
        const body = (ctx.body ?? {}) as { email?: unknown };
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const eref = email ? await ref(email) : "";
        const iref = await ipRef(h);

        switch (ctx.path) {
          case "/sign-up/email": {
            await limit(
              h,
              `signup:ip:${iref}`,
              LIMITS.signupIp,
              AUTH_ERROR.rateLimited,
              "Too many sign-ups from this network. Try again later.",
              "signup_ip",
            );
            await requireCaptcha(h);
            if (email) {
              const found = await ctx.context.internalAdapter.findUserByEmail(email);
              if (found?.user) {
                throw new APIError("UNPROCESSABLE_ENTITY", {
                  code: AUTH_ERROR.emailAlreadyRegistered,
                  message: "An account with this email already exists.",
                });
              }
            }
            return;
          }
          case "/invite/accept":
            await limit(
              h,
              `signup:ip:${iref}`,
              LIMITS.signupIp,
              AUTH_ERROR.rateLimited,
              "Too many attempts. Try again later.",
              "invite_ip",
            );
            await requireCaptcha(h);
            return;
          case "/sign-in/email": {
            await limit(
              h,
              `signin:ip:${iref}`,
              LIMITS.signinIp,
              AUTH_ERROR.rateLimited,
              "Too many attempts from this network. Try again later.",
              "signin_ip",
            );
            const r = await hit(env.DB, `signin:email:${eref}`, LIMITS.signinEmail);
            if (!r.allowed) {
              await audit(h, {
                action: "rate_limit.hit",
                target: `email:${eref}`,
                meta: { scope: "signin_email" },
              });
              await notifyTooManyAttempts(email, eref, h);
              throw tooMany(
                AUTH_ERROR.tooManyAttempts,
                "Too many attempts. Sign-in is paused for a few minutes.",
                r.retryAfterSec,
              );
            }
            if (
              (await peek(env.DB, `signinfail:${eref}`, LIMITS.signinFailures)) >=
              CAPTCHA_AFTER_FAILURES
            ) {
              await requireCaptcha(h);
            }
            return;
          }
          case "/sign-in/magic-link":
            await limit(
              h,
              `magic:ip:${iref}`,
              LIMITS.magicIp,
              AUTH_ERROR.rateLimited,
              "Too many attempts from this network. Try again later.",
              "magic_ip",
            );
            await limit(
              h,
              `magic:email:${eref}`,
              LIMITS.magicEmail,
              AUTH_ERROR.rateLimited,
              "Too many requests. Try again later.",
              "magic_email",
            );
            await requireCaptcha(h);
            return;
          case "/passkey/verify-authentication":
            await limit(
              h,
              `signin:ip:${iref}`,
              LIMITS.signinIp,
              AUTH_ERROR.rateLimited,
              "Too many attempts from this network. Try again later.",
              "signin_ip",
            );
            return;
          case "/request-password-reset":
            await limit(
              h,
              `reset:email:${eref}`,
              LIMITS.resetEmail,
              AUTH_ERROR.rateLimited,
              "Too many requests. Try again later.",
              "reset_email",
            );
            await requireCaptcha(h);
            return;
          case "/send-verification-email":
            await limit(
              h,
              `resend:${eref}`,
              LIMITS.resendEmail,
              AUTH_ERROR.resendLimit,
              "You've asked for too many emails. Try again later.",
              "resend_email",
            );
            return;
          case "/verify-email": {
            const token = String(ctx.query?.token ?? "");
            const used = token
              ? await (await context()).internalAdapter.consumeVerificationValue(
                  `email-verify:${token}`,
                )
              : null;
            if (!used) {
              const cb = safePath(String(ctx.query?.callbackURL ?? ""), "");
              if (cb) {
                throw ctx.redirect(`${cb}${cb.includes("?") ? "&" : "?"}error=INVALID_TOKEN`);
              }
              throw new APIError("BAD_REQUEST", {
                code: "INVALID_TOKEN",
                message: "This link is invalid, expired or already used.",
              });
            }
            return;
          }
          case "/change-password":
            // Every other session is revoked on a password change.
            return { context: { body: { ...(ctx.body as object), revokeOtherSessions: true } } };
          case "/sign-out": {
            const s = await getSessionFromCtx(ctx);
            if (s)
              await audit(h, {
                actor: s.user.id,
                action: "session.revoked",
                meta: { scope: "sign_out" },
              });
            return;
          }
          case "/revoke-sessions":
          case "/revoke-other-sessions": {
            const s = await getSessionFromCtx(ctx);
            if (s)
              await audit(h, {
                actor: s.user.id,
                action: "session.revoked",
                meta: { scope: ctx.path.slice(1) },
              });
            return;
          }
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const h = ctx.headers ?? new Headers();
        const returned = ctx.context.returned as unknown;
        const failed = isAPIError(returned);
        const body = (ctx.body ?? {}) as { email?: unknown };
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const eref = email ? await ref(email) : "";
        const ok = returned as { user?: { id?: string } } | undefined;

        switch (ctx.path) {
          case "/sign-in/email": {
            if (!failed) {
              await clear(env.DB, `signinfail:${eref}`);
              await audit(h, {
                actor: ok?.user?.id ?? null,
                action: "signin.success",
                meta: { method: "password" },
              });
              return;
            }
            const code = (returned.body as { code?: string } | undefined)?.code;
            if (code === "EMAIL_NOT_VERIFIED") {
              // Allowed exception: reached only with the correct password.
              throw new APIError("FORBIDDEN", {
                code: AUTH_ERROR.emailNotVerified,
                message: "Confirm your email to sign in. We've sent you a new link.",
              });
            }
            if (code === "INVALID_EMAIL_OR_PASSWORD") {
              await hit(env.DB, `signinfail:${eref}`, LIMITS.signinFailures);
              await audit(h, {
                action: "signin.failure",
                target: `email:${eref}`,
                meta: { method: "password" },
              });
            }
            return;
          }
          case "/sign-up/email":
            if (!failed)
              await audit(h, {
                actor: ok?.user?.id ?? null,
                action: "signup",
                meta: { method: "password" },
              });
            return;
          case "/sign-in/magic-link":
            if (!failed) await audit(h, { action: "magic_link.sent", target: `email:${eref}` });
            return;
          case "/magic-link/verify":
            if (
              !failed &&
              (ctx.context.newSession as { user?: { id?: string } } | null)?.user?.id
            ) {
              await audit(h, {
                actor: (ctx.context.newSession as { user: { id: string } }).user.id,
                action: "magic_link.used",
              });
              await audit(h, {
                actor: (ctx.context.newSession as { user: { id: string } }).user.id,
                action: "signin.success",
                meta: { method: "magic_link" },
              });
            }
            return;
          case "/request-password-reset":
            if (!failed)
              await audit(h, { action: "password_reset.requested", target: `email:${eref}` });
            return;
          case "/change-password":
            if (!failed) {
              const s = ctx.context.newSession as { user?: { id?: string; email?: string } } | null;
              const id = s?.user?.id ?? ok?.user?.id;
              await audit(h, {
                actor: id ?? null,
                action: "password.changed",
                meta: { sessionsRevoked: true },
              });
              const to = s?.user?.email ?? (ok?.user as { email?: string } | undefined)?.email;
              if (to) {
                await enqueueAuthEmail(env, {
                  type: "password-updated",
                  to,
                  when: now().toUTCString(),
                  device: describeDevice(h.get("user-agent")),
                });
              }
            }
            return;
        }
      }),
    },
    plugins: [
      magicLink({
        expiresIn: 15 * 60,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          await enqueueAuthEmail(env, {
            type: "magic-link",
            to: email,
            link: safeLink(env, url, {
              callbackURL: "/dashboard",
              newUserCallbackURL: "/onboarding",
              errorCallbackURL: "/sign-in?error=link",
            }),
          });
        },
      }),
      passkey({ rpID, rpName: "Matr Studio", origin: web }),
      passwordPolicyPlugin as unknown as BetterAuthPlugin,
      inviteAcceptPlugin,
    ],
  });
  authRef.current = auth as unknown as { $context: Promise<AuthContext> };

  const emailChanges = new Map<string, { oldEmail: string; headers?: Headers }>();

  async function notifyTooManyAttempts(email: string, eref: string, h: Headers) {
    if (!email) return;
    const once = await hit(env.DB, `notice:${eref}`, LIMITS.tooManyNotice);
    if (!once.allowed) return;
    const found = await (await context()).internalAdapter.findUserByEmail(email);
    if (!found?.user) return;
    await enqueueAuthEmail(env, {
      type: "too-many-attempts",
      to: found.user.email,
      when: now().toUTCString(),
      device: describeDevice(h.get("user-agent")),
    });
  }

  return auth;
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export { hashSessionToken };
