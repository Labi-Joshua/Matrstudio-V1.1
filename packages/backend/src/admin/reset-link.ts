import { getAuth } from "../auth/index";
import type { Bindings } from "../env";
import { enqueueAuthEmail } from "../queue/auth-email";

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const RESET_TTL_SECONDS = 15 * 60; // same as emailAndPassword.resetPasswordTokenExpiresIn

/**
 * Starts the learner's normal password reset on their behalf, with the same machinery as the
 * "Forgot password" page: a single-use verification record (stored hashed by Better Auth) and the
 * same "reset-password" email to the learner's own address. The link is never returned to the
 * admin, so an admin cannot take the account over with it. Captcha and the learner's own reset
 * limit do not apply (the admin routes have their own limits).
 */
export async function sendResetLinkTo(
  env: Bindings,
  user: { id: string; email: string },
): Promise<void> {
  const ctx = await getAuth(env).$context;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
    ALPHABET.charAt(b % ALPHABET.length),
  ).join("");
  await ctx.internalAdapter.createVerificationValue({
    value: user.id,
    identifier: `reset-password:${token}`,
    expiresAt: new Date(Date.now() + RESET_TTL_SECONDS * 1000),
  });
  const web = new URL(env.PUBLIC_WEB_URL).origin;
  await enqueueAuthEmail(env, {
    type: "reset-password",
    to: user.email,
    link: `${web}/reset-password?token=${encodeURIComponent(token)}`,
  });
}
