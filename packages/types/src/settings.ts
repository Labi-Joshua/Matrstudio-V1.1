import { z } from "zod";

// --- Settings: preferences and account (packages/backend/SETTINGS.md) ---------------------------
// Times in these APIs are ISO 8601 strings.

export const REMINDER_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type ReminderDay = (typeof REMINDER_DAYS)[number];
export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 14;

export type UserPrefs = {
  /** In the app, under the bell. */
  notifications: { submissions: boolean; lessons: boolean; helpReplies: boolean };
  /** By email. */
  email: { digest: boolean; reminders: boolean; news: boolean };
  /** Days (in week order, no duplicates) and a local "HH:MM" time for the learning reminder. */
  reminders: { days: ReminderDay[]; time: string };
  learning: { weeklyGoal: number };
};

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** PATCH /api/me/prefs: any subset of the fields, at least one. Unknown keys are refused. */
export const prefsPatchSchema = z
  .object({
    notifications: z
      .object({
        submissions: z.boolean().optional(),
        lessons: z.boolean().optional(),
        helpReplies: z.boolean().optional(),
      })
      .strict()
      .optional(),
    email: z
      .object({
        digest: z.boolean().optional(),
        reminders: z.boolean().optional(),
        news: z.boolean().optional(),
      })
      .strict()
      .optional(),
    reminders: z
      .object({
        days: z
          .array(z.enum(REMINDER_DAYS))
          .max(7)
          .transform((d) => REMINDER_DAYS.filter((x) => d.includes(x)))
          .optional(),
        time: time.optional(),
      })
      .strict()
      .optional(),
    learning: z
      .object({
        weeklyGoal: z.number().int().min(WEEKLY_GOAL_MIN).max(WEEKLY_GOAL_MAX).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (v) =>
      Object.values(v).some((group) => group && Object.values(group).some((x) => x !== undefined)),
    { message: "Send at least one setting." },
  );
export type UserPrefsPatch = z.input<typeof prefsPatchSchema>;

export const DEFAULT_PREFS: UserPrefs = {
  notifications: { submissions: true, lessons: true, helpReplies: true },
  email: { digest: true, reminders: true, news: false },
  reminders: { days: ["mon", "wed", "fri"], time: "19:00" },
  learning: { weeklyGoal: 3 },
};

export type AccountSummary = {
  /** The account has a password (a Google-only account can set one). */
  hasPassword: boolean;
  google: { linked: boolean };
  passkeyCount: number;
  /** A change waiting for the link in the email sent to the new address. */
  pendingEmail: { email: string; requestedAt: string; expiresAt: string } | null;
  /** What deleting the account removes (rows owned by the learner). */
  counts: { saved: number; submissions: number };
};

export type AccountErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "reauth_required"
  | "rate_limited"
  | "not_found"
  | "last_sign_in_method"
  | "password_exists"
  | "same_email";

export const emailChangeSchema = z
  .object({
    newEmail: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    password: z.string().max(128).optional(),
  })
  .strict();
export const reauthSchema = z.object({ password: z.string().max(128).optional() }).strict();
export const setPasswordSchema = z.object({ newPassword: z.string().min(12).max(128) }).strict();
