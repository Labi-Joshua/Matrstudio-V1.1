import type { AuthEmailMessage } from "./lib/auth-email-templates";

export type Bindings = {
  // Resource bindings
  DB: D1Database;
  BUCKET?: R2Bucket; // optional until R2 is enabled on the account (see wrangler.toml)
  SIGNUP_LIMITER: RateLimit;
  API_LIMITER: RateLimit;
  AUTH_EMAIL_QUEUE: Queue<AuthEmailMessage>;

  // Plain vars (wrangler.toml [vars], overridden locally by .dev.vars)
  ENVIRONMENT: "development" | "production";
  ALLOWED_ORIGINS: string; // comma-separated
  PUBLIC_WEB_URL: string;
  PUBLIC_API_URL: string;
  PUBLIC_ADMIN_URL?: string; // admin app origin: the only base for emailed admin links (default https://admin.matrstudio.com)
  EMAIL_FROM: string;
  R2_BUCKET_NAME: string;

  // Secrets (wrangler secret put / .dev.vars)
  VERIFY_SECRET: string;
  ADMIN_API_TOKEN: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  CF_ACCOUNT_ID: string;
  // Usage alerts (cron): optional; the monitor skips itself until CF_API_TOKEN and at least
  // one destination (webhook or email) are set.
  CF_API_TOKEN?: string; // Account Analytics: Read
  ALERT_WEBHOOK_URL?: string; // Slack/Discord-style webhook
  ALERT_EMAIL?: string; // sent through Resend; a secret so the address stays out of the repo
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  // Learner auth (see AUTH.md)
  BETTER_AUTH_SECRET: string; // 32+ random bytes
  GOOGLE_CLIENT_ID?: string; // Google sign-in is enabled only when both are set
  GOOGLE_CLIENT_SECRET?: string;
  // Admin auth (see ADMIN-AUTH.md)
  CF_ACCESS_TEAM_DOMAIN?: string; // e.g. "matrstudio" or "matrstudio.cloudflareaccess.com"
  CF_ACCESS_AUD?: string; // Access application AUD tag (secret)
  ADMIN_TOTP_KEY?: string; // optional dedicated key for TOTP secrets at rest; falls back to BETTER_AUTH_SECRET
  ADMIN_BOOTSTRAP_EMAIL?: string; // first super admin; consumed by the cron bootstrap, then delete it
  // Test/dev knobs, ignored when ENVIRONMENT is "production"
  PASSWORD_SCRYPT_N?: string; // lower scrypt cost for tests
  AUTH_MIN_RESPONSE_MS?: string; // floor for no-enumeration endpoints (default 400)
  ADMIN_DEV_BYPASS_ACCESS?: string; // "true" skips the Access check, only when ENVIRONMENT is "development"
};

export type AppEnv = { Bindings: Bindings };
