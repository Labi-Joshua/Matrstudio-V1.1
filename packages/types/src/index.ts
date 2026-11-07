import { z } from "zod";

/** POST /api/waitlist request body. Shared by the Worker (validation) and the forms (typing). */
export const waitlistSignupSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  referralCode: z
    .string()
    .regex(/^[0-9A-HJKMNP-TV-Z]{8}$/)
    .optional(),
  turnstileToken: z.string().max(2048).optional(),
  metadata: z
    .object({
      source: z.string().max(64).optional(),
      utmSource: z.string().max(64).optional(),
      utmCampaign: z.string().max(64).optional(),
    })
    .optional(),
});
export type WaitlistSignupRequest = z.input<typeof waitlistSignupSchema>;

/**
 * POST /api/waitlist/resend: a new confirmation link for the address in an expired link.
 * The signed token proves the request came from that email, so no address is typed.
 */
export const waitlistResendSchema = z.object({ token: z.string().min(16).max(1024) });
export type WaitlistResendRequest = z.input<typeof waitlistResendSchema>;

export type WaitlistSignupResponse = { ok: true };
export type WaitlistStatsResponse = { total: number };
export type HealthResponse = { ok: true; env: string; time: string };

export type PresignUploadRequest = {
  filename: string;
  contentType: string;
  size: number;
};
export type PresignUploadResponse = {
  method: "PUT";
  url: string;
  key: string;
  headers: Record<string, string>;
  expiresIn: number;
};

export type ApiErrorBody = {
  ok: false;
  error: { code: string; message: string };
};

// --- Learner onboarding (POST /api/me/onboarding) ---------------------------------------------
// Goals and levels follow the onboarding design; topics are the catalogue topic slugs.
export const ONBOARDING_GOALS = [
  "get_first_job",
  "switch_careers",
  "level_up",
  "freelance",
  "just_exploring",
] as const;
export const ONBOARDING_LEVELS = ["beginner", "intermediate", "advanced"] as const;
/** Same slugs as the topics in apps/web/lib/catalogue (the /paths/{topic} pages). */
export const ONBOARDING_TOPICS = [
  "ui-ux",
  "brand",
  "product",
  "seo",
  "social-media",
  "design-systems",
  "dev-handoff",
] as const;

export const onboardingSchema = z
  .object({
    goal: z.enum(ONBOARDING_GOALS).optional(),
    level: z.enum(ONBOARDING_LEVELS).optional(),
    topics: z
      .array(z.enum(ONBOARDING_TOPICS))
      .min(1)
      .max(ONBOARDING_TOPICS.length)
      .transform((t) => [...new Set(t)])
      .optional(),
  })
  .strict()
  .refine((v) => v.goal !== undefined || v.level !== undefined || v.topics !== undefined, {
    message: "Send at least one of goal, level, topics.",
  });
export type OnboardingRequest = z.input<typeof onboardingSchema>;

export type OnboardingState = {
  goal: (typeof ONBOARDING_GOALS)[number] | null;
  level: (typeof ONBOARDING_LEVELS)[number] | null;
  topics: Array<(typeof ONBOARDING_TOPICS)[number]>;
  completed: boolean;
  completedAt: number | null; // unix seconds
};

export type MeResponse = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  onboarding: OnboardingState;
  /** "password" | "google" (linked sign-in methods); passkeys are counted separately. */
  providers: string[];
  passkeyCount: number;
};

export type SessionSummary = {
  id: string;
  current: boolean;
  device: string;
  ip: string; // truncated, e.g. 203.0.113.0
  createdAt: string;
  lastSeenAt: string;
};
