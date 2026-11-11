import { z } from "zod";
import type { AdminArea, AdminLevel, AdminPermissions } from "./index";

// --- Admin team, roles, audit and shell (packages/backend/ADMIN-TEAM.md) ------------------------
// Times in these APIs are ISO 8601 strings.

const id = z.string().min(1).max(64);

export const ADMIN_ROLE_CAP = 20;

/** One role per admin: the design's "pick one or more" is a single choice (roleIds has one item). */
export const adminChangeRoleSchema = z
  .object({
    roleIds: z.array(id).length(1),
    /** A current authenticator code of the acting admin; required when the new role is super_admin. */
    twoStepCode: z.string().trim().min(6).max(16).optional(),
  })
  .strict();
export type AdminChangeRoleRequest = z.input<typeof adminChangeRoleSchema>;

/** `until` is a future date or date-time (at most 1 year ahead); null makes access permanent again. */
export const adminTemporaryAccessSchema = z
  .object({ until: z.iso.datetime({ offset: true }).or(z.iso.date()).nullable() })
  .strict();
export type AdminTemporaryAccessRequest = z.input<typeof adminTemporaryAccessSchema>;

export const adminSuspendSchema = z
  .object({ reason: z.string().trim().max(200).optional() })
  .strict();
export type AdminSuspendRequest = z.input<typeof adminSuspendSchema>;

const permissionLevel = z.enum(["none", "view", "manage"]);
const permissionsInput = z.record(z.string().max(32), permissionLevel);

export const adminRoleCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(200).optional(),
    permissions: permissionsInput,
  })
  .strict();
export type AdminRoleCreateRequest = z.input<typeof adminRoleCreateSchema>;

export const adminRoleUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    description: z.string().trim().max(200).optional(),
    permissions: permissionsInput.optional(),
  })
  .strict();
export type AdminRoleUpdateRequest = z.input<typeof adminRoleUpdateSchema>;

export const adminRoleDuplicateSchema = z
  .object({ name: z.string().trim().min(1).max(60).optional() })
  .strict();
export const adminRoleDeleteSchema = z.object({ moveMembersTo: id.optional() }).strict();
export type AdminRoleDeleteRequest = z.input<typeof adminRoleDeleteSchema>;

export type AdminTeamMemberRow = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  status: "active" | "suspended";
  /** Unix seconds (kept from the first version of GET /team). */
  lastSignInAt: number | null;
  lastSignIn: string | null;
  mfaEnrolled: boolean;
  /** Live admin sessions (signed in on this many devices). */
  sessions: number;
  accessExpiresAt: string | null;
  accessExpired: boolean;
  isYou: boolean;
};

export type AdminPendingInvite = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  invitedBy: { id: string; name: string } | null;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
};

export type AdminTeamListResponse = {
  members: AdminTeamMemberRow[];
  pendingInvites: AdminPendingInvite[];
  /** True when exactly one active Super admin exists (the banner "You're the only Super admin"). */
  onlySuperAdmin: boolean;
};

export type AdminMemberSession = {
  id: string;
  device: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

export type AdminMemberDetail = Omit<AdminTeamMemberRow, "sessions"> & {
  invitedBy: { id: string; name: string } | null;
  invitedAt: string | null;
  joinedAt: string | null;
  mfaEnrolledAt: string | null;
  foundingSuperAdmin: boolean;
  sessions: AdminMemberSession[];
};

export type AdminRoleSummary = {
  id: string;
  name: string;
  description: string | null;
  builtIn: boolean;
  members: number;
  permissions: AdminPermissions;
};

export type AdminRolesListResponse = {
  roles: AdminRoleSummary[];
  customCount: number;
  customLimit: number;
};

export type AdminRoleDetail = AdminRoleSummary & {
  memberList: { id: string; name: string }[];
};

export type AdminRoleDiffItem = { area: AdminArea; from: AdminLevel; to: AdminLevel };
export type AdminRolePreview = {
  changes: AdminRoleDiffItem[];
  nameChanged: boolean;
  affected: { id: string; name: string }[];
  affectedCount: number;
};

export type AdminAuditEntry = {
  id: number;
  at: string;
  actor: { id: string; name: string | null; role: string | null } | null;
  action: string;
  /** Raw target id, plus a readable label when it is an admin or a role. */
  target: string | null;
  targetLabel: string | null;
  before: string | null;
  after: string | null;
  confirmedWith: "password_2step" | null;
  device: string | null;
  ip: string | null;
  detail: Record<string, string | number | boolean | null>;
};

export type AdminAuditListResponse = { entries: AdminAuditEntry[]; nextCursor: string | null };

export type AdminSearchResponse = {
  users: { id: string; name: string; email: string }[];
  resources: { id: string; title: string; status: string | null }[];
  paths: { id: string; title: string; status: string | null }[];
  submissions: { id: string; title: string; status: string }[];
};

export type AdminNotificationItem = {
  id: number;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  read: boolean;
};
export type AdminNotificationsResponse = { notifications: AdminNotificationItem[]; unread: number };
