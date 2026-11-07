import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";
import { getAuth } from "./index";

export type SessionUser = { id: string; email: string; name: string; emailVerified: boolean };
export type SessionInfo = { id: string; createdAt: Date; expiresAt: Date };
export type AuthedEnv = AppEnv & { Variables: { user: SessionUser; session: SessionInfo } };

/** Error body for auth routes: Better Auth's own shape, so one client path handles both. */
export const authError = (code: string, message: string, extra: Record<string, unknown> = {}) => ({
  code,
  message,
  ...extra,
});

/**
 * Deny by default: every route behind this middleware needs a valid session cookie. The user and
 * session come from the server-side lookup only; nothing the client sends is trusted.
 */
export const requireSession: MiddlewareHandler<AuthedEnv> = async (c, next) => {
  const result = await getAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!result?.user || !result.session) {
    return c.json(authError("unauthorized", "Sign in to continue."), 401);
  }
  const { user, session } = result;
  c.set("user", {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
  });
  c.set("session", {
    id: session.id,
    createdAt: new Date(session.createdAt),
    expiresAt: new Date(session.expiresAt),
  });
  await next();
};

export type Area = "learner.self" | (string & {});
export type Level = "none" | "view" | "manage";

/**
 * Permission check, one helper for every handler (SECURITY-AUTH.md section 7). Stub: only learners
 * exist for now, and a learner can manage their own data (`learner.self`) and nothing else.
 * Admin roles (area permissions none/view/manage) come later; unknown areas fail closed.
 */
export function can(user: SessionUser | null | undefined, area: Area, level: Level): boolean {
  if (!user) return false;
  if (level === "none") return true;
  return area === "learner.self";
}
