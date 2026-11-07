import type { Bindings } from "../env";

export type TurnstileResult = "ok" | "failed" | "unavailable";

/**
 * Verifies a Cloudflare Turnstile token. With no TURNSTILE_SECRET the check is skipped, but only
 * outside production; in production a missing secret fails closed ("unavailable").
 */
export async function verifyTurnstile(
  env: Pick<Bindings, "TURNSTILE_SECRET" | "ENVIRONMENT">,
  token: string | null,
  ip: string,
): Promise<TurnstileResult> {
  if (!env.TURNSTILE_SECRET) return env.ENVIRONMENT === "production" ? "unavailable" : "ok";
  if (!token) return "failed";
  try {
    const body = new FormData();
    body.set("secret", env.TURNSTILE_SECRET);
    body.set("response", token);
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    if (!res.ok) return "unavailable";
    const json = (await res.json()) as { success?: boolean };
    return json.success ? "ok" : "failed";
  } catch {
    return "unavailable";
  }
}
