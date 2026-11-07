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
  "learn_new_skill",
  "grow_in_role",
  "switch_careers",
  "build_projects",
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

// --- Admin auth (packages/backend/ADMIN-AUTH.md) ------------------------------------------------
// Areas follow the admin side menu in the design (Overview, Content, Review, People, Admin).
export const ADMIN_AREAS = [
  "dashboard",
  "metrics",
  "resources",
  "paths",
  "review_queues",
  "users_waitlist",
  "support_inbox",
  "admin_team",
  "roles",
  "audit_log",
  "settings",
] as const;
export type AdminArea = (typeof ADMIN_AREAS)[number];
export type AdminLevel = "none" | "view" | "manage";
export type AdminPermissions = Record<AdminArea, AdminLevel>;

/** Error body of every admin auth route: { code, message, ...extra }. */
export type AdminErrorBody = {
  code: string;
  message: string;
  retryAfterSeconds?: number;
  invitedBy?: string | null;
  invitedAt?: number;
};

export const adminSignInSchema = z
  .object({ email: z.string().trim().toLowerCase().max(254), password: z.string().min(1).max(128) })
  .strict();
export type AdminSignInRequest = z.input<typeof adminSignInSchema>;

/** A 6-digit authenticator code, or a backup code ("xxxxx-xxxxx"). */
export const adminCodeSchema = z.string().trim().min(6).max(16);
export const adminMfaSchema = z.object({ code: adminCodeSchema }).strict();
export type AdminMfaRequest = z.input<typeof adminMfaSchema>;

export const adminReauthSchema = z
  .object({ password: z.string().min(1).max(128), code: adminCodeSchema })
  .strict();
export type AdminReauthRequest = z.input<typeof adminReauthSchema>;

const inviteToken = z.string().min(20).max(300);
export const adminInviteAcceptSchema = z
  .object({
    token: inviteToken,
    password: z.string().max(256),
    name: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type AdminInviteAcceptRequest = z.input<typeof adminInviteAcceptSchema>;
export const adminInviteEnrolSchema = z
  .object({ token: inviteToken, code: z.string().trim().length(6) })
  .strict();
export type AdminInviteEnrolRequest = z.input<typeof adminInviteEnrolSchema>;

export const adminTeamInviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    roleId: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type AdminTeamInviteRequest = z.input<typeof adminTeamInviteSchema>;

export type AdminMeResponse = {
  id: string;
  email: string;
  name: string;
  role: { id: string; name: string };
  permissions: AdminPermissions;
  /** Areas the admin may open (permission above none), in side-menu order. */
  menu: AdminArea[];
  mfaEnrolled: boolean;
  /** Unix seconds of the last sign-in or step-up; null when none. */
  lastReauthAt: number | null;
  /** True while the last step-up is recent enough (5 minutes) for sensitive actions. */
  fresh: boolean;
  /** Unix seconds when the session ends if idle, and its hard cap. */
  sessionExpiresAt: number;
  sessionAbsoluteExpiresAt: number;
};

export type AdminSignInResponse = { status: "mfa_required" };
export type AdminMfaResponse = { admin: AdminMeResponse; backupCodesRemaining: number };
export type AdminReauthResponse = { lastReauthAt: number };
export type AdminInviteCheckResponse = {
  status: "ok";
  emailHint: string;
  role: string;
  expiresAt: number;
};
export type AdminEnrolmentResponse = {
  step: "mfa";
  /** otpauth:// URI: render it as the QR code. Contains the secret, show it only on this screen. */
  otpauthUri: string;
  /** The same secret grouped for typing ("JBSW Y3DP EHPK 3PXP"). */
  secretKey: string;
};
export type AdminInviteCompleteResponse = { admin: AdminMeResponse; backupCodes: string[] };
export type AdminTeamMember = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  status: "invited" | "active" | "suspended";
  lastSignInAt: number | null;
};

export const adminChangePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().max(256) })
  .strict();
export type AdminChangePasswordRequest = z.input<typeof adminChangePasswordSchema>;

// --- Resource submissions (packages/backend/SUBMISSIONS.md) -------------------------------------
/** The catalogue topic slugs (same list as ONBOARDING_TOPICS: one source of truth). */
export const TOPICS = ONBOARDING_TOPICS;
export type Topic = (typeof TOPICS)[number];

export const SUBMISSION_STATUSES = ["in_review", "accepted", "declined", "needs_changes"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export const SUBMISSION_LIMITS = { url: 2048, title: 200, note: 1000 } as const;

// Plain text, trimmed; an empty string means "none" and is stored as null.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullish();

export const createSubmissionSchema = z
  .object({
    url: z.string().trim().min(1).max(SUBMISSION_LIMITS.url),
    title: optionalText(SUBMISSION_LIMITS.title),
    note: optionalText(SUBMISSION_LIMITS.note),
    topic: z.enum(TOPICS).nullish(),
  })
  .strict();
export type CreateSubmissionBody = z.input<typeof createSubmissionSchema>;

export const updateSubmissionSchema = z
  .object({
    title: optionalText(SUBMISSION_LIMITS.title),
    note: optionalText(SUBMISSION_LIMITS.note),
    topic: z.enum(TOPICS).nullish(),
  })
  .strict()
  .refine((v) => v.title !== undefined || v.note !== undefined || v.topic !== undefined, {
    message: "Send at least one of title, note, topic.",
  });
export type UpdateSubmissionBody = z.input<typeof updateSubmissionSchema>;

export type Submission = {
  id: string;
  url: string;
  title: string | null;
  note: string | null;
  topic: Topic | null;
  status: SubmissionStatus;
  /** Reviewer's message; null until a curator has decided. */
  curatorNote: string | null;
  createdAt: number; // unix seconds
  updatedAt: number; // unix seconds
};
export type CreateSubmissionResponse = { submission: Submission };
export type ListSubmissionsResponse = { submissions: Submission[] };
export type UpdateSubmissionResponse = { submission: Submission };

/** Error body: { code, message, ...extra } like every auth route. */
export type SubmissionErrorBody = {
  code:
    | "invalid_request"
    | "invalid_url"
    | "already_submitted"
    | "captcha_required"
    | "captcha_failed"
    | "captcha_unavailable"
    | "rate_limited"
    | "not_editable"
    | "not_found"
    | "unauthorized";
  message: string;
  fieldErrors?: Partial<Record<"url" | "title" | "note" | "topic", string>>;
  retryAfterSeconds?: number;
};
