import { writeAudit } from "../auth/audit";
import type { Bindings } from "../env";
import { type AuthEmailMessage, renderAuthEmail } from "../lib/auth-email-templates";

export const AUTH_EMAIL_MAX_ATTEMPTS = 4; // keep in step with max_retries = 3 in wrangler.toml (1 try + 3 retries)

/** Producer side. Emails are only ever sent by the consumer below, never inline in a request. */
export async function enqueueAuthEmail(env: Bindings, msg: AuthEmailMessage): Promise<void> {
  try {
    await env.AUTH_EMAIL_QUEUE.send(msg, { contentType: "json" });
  } catch (err) {
    // The caller's response must not depend on (or reveal) delivery. No address in the log.
    console.error("auth email enqueue failed", msg.type, err instanceof Error ? err.name : "error");
  }
}

async function sendViaResend(env: Bindings, msg: AuthEmailMessage): Promise<void> {
  const { subject, html, text } = renderAuthEmail(env.PUBLIC_WEB_URL, msg);
  if (!env.RESEND_API_KEY) {
    if (env.ENVIRONMENT === "production") throw new Error("RESEND_API_KEY is not set");
    console.log("auth email skipped (no RESEND_API_KEY)", msg.type); // local development
    return;
  }
  // Click and open tracking must be OFF for the sending domain in the Resend dashboard (Domains >
  // matrstudio.com > Configuration): a tracked link would route the one-time token through a third
  // party redirect. The API has no per-message switch.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: msg.to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

/**
 * Consumer. Failures are retried with a growing delay (wrangler.toml max_retries). There is no
 * dead-letter queue (it would have to exist on the account before a deploy); instead the final
 * failure is acknowledged and recorded in the audit log as email.dropped (type only, no address).
 */
export async function handleAuthEmailBatch(
  batch: MessageBatch<AuthEmailMessage>,
  env: Bindings,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await sendViaResend(env, message.body);
      message.ack();
    } catch (err) {
      const reason = err instanceof Error ? err.message.slice(0, 40) : "error";
      if (message.attempts >= AUTH_EMAIL_MAX_ATTEMPTS) {
        console.error("auth email dropped", message.body.type, reason);
        await writeAudit(env.DB, {
          action: "email.dropped",
          meta: { type: message.body.type, reason },
        });
        message.ack();
      } else {
        console.error("auth email retry", message.body.type, reason);
        message.retry({ delaySeconds: 30 * message.attempts ** 2 });
      }
    }
  }
}
