import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";

/** Better Auth's built-in fallback secret. It is public, so it must never be in use. */
const LIBRARY_DEFAULT_SECRET = "better-auth-secret-12345678901234567890";

export const MIN_SECRET_LENGTH = 32;

export function authSecretProblem(secret: string | undefined): string | null {
  if (!secret) return "BETTER_AUTH_SECRET is not set";
  if (secret === LIBRARY_DEFAULT_SECRET) return "BETTER_AUTH_SECRET is the library default";
  if (secret.length < MIN_SECRET_LENGTH) return "BETTER_AUTH_SECRET is shorter than 32 characters";
  return null;
}

/**
 * Fails closed: without a proper BETTER_AUTH_SECRET, every auth, account and admin route answers
 * 503. Better Auth itself does not protect us here: when no secret is passed it quietly falls back
 * to its public default, and its own production check keys off process.env.NODE_ENV, which Workers
 * do not have.
 */
export const requireAuthSecret: MiddlewareHandler<AppEnv> = async (c, next) => {
  const problem = authSecretProblem(c.env.BETTER_AUTH_SECRET);
  if (problem) {
    console.error(`auth disabled: ${problem}`);
    return c.json(
      { code: "auth_unavailable", message: "Sign-in is not available right now." },
      503,
    );
  }
  await next();
};
