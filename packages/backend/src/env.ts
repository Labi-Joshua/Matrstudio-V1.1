export type Bindings = {
  // Resource bindings
  DB: D1Database;
  BUCKET?: R2Bucket; // optional until R2 is enabled on the account (see wrangler.toml)
  SIGNUP_LIMITER: RateLimit;
  API_LIMITER: RateLimit;

  // Plain vars (wrangler.toml [vars], overridden locally by .dev.vars)
  ENVIRONMENT: "development" | "production";
  ALLOWED_ORIGINS: string; // comma-separated
  PUBLIC_WEB_URL: string;
  PUBLIC_API_URL: string;
  EMAIL_FROM: string;
  R2_BUCKET_NAME: string;

  // Secrets (wrangler secret put / .dev.vars)
  VERIFY_SECRET: string;
  ADMIN_API_TOKEN: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  CF_ACCOUNT_ID: string;
  // Usage alerts (cron): optional; the monitor skips itself until both are set.
  CF_API_TOKEN?: string; // Account Analytics: Read
  ALERT_WEBHOOK_URL?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
};

export type AppEnv = { Bindings: Bindings };
