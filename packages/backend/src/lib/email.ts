import type { Bindings } from "../env";
import { confirmEmail } from "./email-templates";
import { signVerifyToken } from "./token";

/**
 * How long a confirmation link stays valid. The email states it, so both come from here.
 * Signing up again does not resend the link, so keep this generous.
 */
const VERIFY_TTL_DAYS = 7;

/** Fire-and-forget from ctx.waitUntil(): the network wait does not count toward the 10 ms CPU budget. */
export async function sendVerificationEmail(env: Bindings, email: string): Promise<void> {
  if (!env.RESEND_API_KEY) return; // not configured (e.g. local development)
  const token = await signVerifyToken(env.VERIFY_SECRET, email, VERIFY_TTL_DAYS * 24 * 3600);
  const link = `${env.PUBLIC_API_URL}/api/waitlist/verify?token=${encodeURIComponent(token)}`;
  const { subject, html, text } = confirmEmail({
    link,
    email,
    webUrl: env.PUBLIC_WEB_URL,
    expiresIn: `${VERIFY_TTL_DAYS} days`,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: email, subject, html, text }),
  });
  if (!res.ok) console.error("verification email failed", res.status);
}

/** Operational alert (usage monitor) to ALERT_EMAIL, through Resend. */
export async function sendAlertEmail(env: Bindings, subject: string, text: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.ALERT_EMAIL) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: env.ALERT_EMAIL, subject, text }),
  });
  if (!res.ok) console.error("alert email failed", res.status);
}
