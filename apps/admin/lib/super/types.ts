/** Shapes the Super admin screens read. Parsers in parse.ts build them from /api/admin/* replies. */
export type Level = "none" | "view" | "manage";

export const AREAS = [
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
export type Area = (typeof AREAS)[number];
export type Permissions = Record<Area, Level>;

export const SUPER_ADMIN_ID = "super_admin";

export type MemberStatus = "invited" | "active" | "suspended";

export type Member = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  status: MemberStatus;
  /** Sign-in paused after too many tries (unlock clears it). */
  locked: boolean;
  /** ms since epoch */
  lastSignInAt: number | null;
  twoStep: boolean;
  /** Temporary access: ms since epoch when access ends. */
  accessExpiresAt: number | null;
};

export type Invite = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  invitedBy: string;
  createdAt: number | null;
  expiresAt: number | null;
};

export type AdminSession = {
  id: string;
  device: string;
  location: string;
  lastActiveAt: number | null;
  current: boolean;
};

export type MemberDetail = Member & {
  invitedBy: string;
  joinedAt: number | null;
  twoStepSetUpAt: number | null;
  sessions: AdminSession[];
  sessionCount: number;
  lastSignInPlace: string;
};

export type RoleSummary = {
  id: string;
  name: string;
  description: string;
  builtIn: boolean;
  members: number;
  permissions: Permissions;
  updatedAt: number | null;
  updatedBy: string;
};

export type RoleMember = { id: string; name: string };
export type RoleDetail = RoleSummary & { memberList: RoleMember[] };

export type RolesList = { roles: RoleSummary[]; customLimit: number };

export type AuditEntry = {
  id: string;
  at: number | null;
  actorId: string;
  actorName: string;
  actorRole: string;
  /** Machine action, e.g. "admin.role.assigned". */
  action: string;
  targetId: string;
  targetLabel: string;
  /** One line under the target in the table, e.g. "Support → Support + Curator". */
  summary: string;
  before: string;
  after: string;
  confirmedWith: string;
  device: string;
  ip: string;
};

export type AuditPage = { entries: AuditEntry[]; nextCursor: string | null };

export type RoleDiffLine = { label: string; before: string; after: string };
export type RolePreview = { diff: RoleDiffLine[] | null; affected: RoleMember[] | null };

export type MeInfo = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: Permissions;
};
