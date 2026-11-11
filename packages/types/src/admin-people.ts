import { z } from "zod";

// --- Admin portal: users, waitlist, support inbox, dashboard, metrics (packages/backend/ADMIN-PEOPLE.md)
// All times are ISO 8601 strings.

export const ADMIN_RANGES = ["today", "7d", "30d", "90d", "custom"] as const;
export type AdminRange = (typeof ADMIN_RANGES)[number];
export const METRIC_TABS = ["learners", "paths", "library", "emails", "support"] as const;
export type MetricTab = (typeof METRIC_TABS)[number];

// Users
export const USER_STATUSES = ["active", "suspended", "unconfirmed"] as const;
export type AdminUserStatus = (typeof USER_STATUSES)[number];
/** Reason codes the portal offers; the API stores any short code. */
export const SUSPEND_REASONS = ["spam", "guidelines", "security", "other"] as const;
export type SuspendReason = string;
/** `message` is the text emailed to the learner (never shown to other learners). */
export const adminSuspendSchema = z
  .object({
    reason: z.string().trim().min(1).max(60),
    message: z.string().trim().max(1000).optional(),
  })
  .strict();
export type AdminSuspendBody = z.input<typeof adminSuspendSchema>;
/** `confirm` must equal the learner's email address (typed by the admin). */
export const adminDeleteUserSchema = z
  .object({ confirm: z.string().trim().min(3).max(320), emailCopy: z.boolean().optional() })
  .strict();
export type AdminDeleteUserBody = z.input<typeof adminDeleteUserSchema>;

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  status: AdminUserStatus;
  /** Sign-in methods on the account: "password", "google", "passkey". */
  authMethods: string[];
  pathsCount: number;
  lastSignInAt: string | null;
};
export type AdminUsersResponse = { users: AdminUserRow[]; nextCursor: string | null };
export type AdminUserDetail = AdminUserRow & {
  emailConfirmed: boolean;
  suspension: { reason: SuspendReason; note: string | null; at: string; by: string } | null;
  profile: { username: string; isPublic: boolean } | null;
  paths: Array<{
    slug: string;
    startedAt: string | null;
    lastActivityAt: string | null;
    completedAt: string | null;
    starredAt: string | null;
    lessonsDone: number;
  }>;
  submissions: Array<{ id: string; title: string | null; status: string; createdAt: string }>;
  tickets: Array<{ id: string; kind: string; subject: string; status: string; createdAt: string }>;
  /** What deleting the account would remove. */
  impact: { paths: number; pathsCompleted: number; submissions: number; openTickets: number };
};

// Waitlist
export const WAITLIST_STATUSES = ["waiting", "invited", "created", "confirmed"] as const;
/** ?status= on GET /waitlist: "joined" is created or confirmed. */
export const WAITLIST_FILTERS = ["waiting", "invited", "joined", ...WAITLIST_STATUSES] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];
export const waitlistInviteSchema = z
  .object({
    count: z.number().int().min(1).max(100).optional(),
    ids: z.array(z.number().int().positive()).min(1).max(100).optional(),
  })
  .strict()
  .refine((v) => (v.count === undefined) !== (v.ids === undefined), "count or ids");
export type WaitlistInviteBody = z.input<typeof waitlistInviteSchema>;
export type WaitlistRow = {
  id: number;
  email: string;
  joinedAt: string;
  status: WaitlistStatus;
  invitedAt: string | null;
  batchId: string | null;
};
export type WaitlistStats = {
  waiting: number;
  oldestWaitingAt: string | null;
  invited: number;
  lastBatchAt: string | null;
  created: number;
  confirmed: number;
};
export type WaitlistBatch = {
  id: string;
  createdAt: string;
  invited: number;
  createdAccount: number;
  confirmed: number;
  /** Still not joined, invited 7+ days ago, never reminded. */
  needReminder: number;
  reminded: number;
  joinedFrom: string | null;
  joinedTo: string | null;
};

// Support inbox
export const INBOX_TABS = ["open", "waiting", "resolved"] as const;
export const ADMIN_TICKET_STATUSES = [
  "open",
  "waiting_on_user",
  "resolved",
  "fixed",
  "cant_reproduce",
] as const;
export type AdminTicketStatus = (typeof ADMIN_TICKET_STATUSES)[number];
export const adminNoteSchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict();
export const adminLogIssueSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(2000).optional(),
    severity: z.enum(["low", "medium", "high"]),
    area: z.string().trim().max(60).optional(),
    linkReportId: z.string().trim().min(1).max(64).optional(),
    notifyRequester: z.boolean().optional(),
  })
  .strict();
export type AdminLogIssueBody = z.input<typeof adminLogIssueSchema>;

/** POST /support/:id/status. `message` goes to the requester (used by fixed and cant_reproduce). */
export const adminTicketStatusSchema = z
  .object({
    status: z.enum(ADMIN_TICKET_STATUSES),
    message: z.string().trim().max(2000).optional(),
  })
  .strict();
export const adminAssignSchema = z.object({ to: z.enum(["me", "nobody"]) }).strict();
