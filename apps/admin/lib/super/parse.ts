import { isRecord } from "../api";
import { toMs } from "./format";
import {
  AREAS,
  type AuditEntry,
  type AuditPage,
  type Invite,
  type Level,
  type MeInfo,
  type Member,
  type MemberDetail,
  type MemberStatus,
  type Permissions,
  type RoleDetail,
  type RoleMember,
  type RolePreview,
  type RoleSummary,
  type RolesList,
} from "./types";

/**
 * Tolerant parsers: they accept the shapes in ADMIN-SPEC section D (and a few spellings of the same
 * field) and return undefined for a reply that is not recognisable, so the UI shows its error state
 * instead of crashing on a surprise.
 */
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const pick = (r: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) if (r[key] !== undefined && r[key] !== null) return r[key];
  return undefined;
};
/** A name that may be a string or { name }. */
const nameOf = (v: unknown): string => (isRecord(v) ? str(v.name) || str(v.email) : str(v));

const isLevel = (v: unknown): v is Level => v === "none" || v === "view" || v === "manage";

export function parsePermissions(v: unknown): Permissions {
  const out = Object.fromEntries(AREAS.map((a) => [a, "none"])) as Permissions;
  if (isRecord(v)) {
    for (const a of AREAS) {
      const level = v[a];
      if (isLevel(level)) out[a] = level;
    }
  }
  return out;
}

const STATUSES: readonly string[] = ["invited", "active", "suspended"];

function parseMemberBase(r: Record<string, unknown>): Member | undefined {
  const id = str(r.id);
  if (!id) return undefined;
  const role = isRecord(r.role) ? r.role : {};
  const rawStatus = str(r.status, "active");
  const status: MemberStatus = STATUSES.includes(rawStatus)
    ? (rawStatus as MemberStatus)
    : "active";
  const twoStepRaw = pick(r, "twoStep", "twoStepEnabled", "mfaEnrolled", "mfa");
  return {
    id,
    email: str(r.email),
    name: str(r.name) || str(r.email),
    roleId: str(r.roleId) || str(role.id),
    roleName: str(r.roleName) || str(role.name) || "Unknown role",
    status,
    locked: r.locked === true || rawStatus === "locked" || toMs(r.lockedUntil) !== null,
    lastSignInAt: toMs(pick(r, "lastSignInAt", "lastSignIn", "lastActiveAt")),
    twoStep: isRecord(twoStepRaw) ? twoStepRaw.enabled !== false : twoStepRaw === true,
    accessExpiresAt: toMs(pick(r, "accessExpiresAt", "accessUntil")),
  };
}

export function parseMembers(json: unknown): Member[] | undefined {
  if (!isRecord(json) || !Array.isArray(json.members)) return undefined;
  const out: Member[] = [];
  for (const item of json.members) {
    const m = isRecord(item) ? parseMemberBase(item) : undefined;
    if (m) out.push(m);
  }
  return out;
}

export function parseInvites(json: unknown): Invite[] | undefined {
  const raw = isRecord(json) ? json.invites : json;
  if (!Array.isArray(raw)) return undefined;
  const out: Invite[] = [];
  for (const item of raw) {
    if (!isRecord(item) || !str(item.id)) continue;
    const role = isRecord(item.role) ? item.role : {};
    out.push({
      id: str(item.id),
      email: str(item.email),
      name: str(item.name),
      roleId: str(item.roleId) || str(role.id),
      roleName: str(item.roleName) || str(role.name) || "Unknown role",
      invitedBy: nameOf(pick(item, "invitedBy", "createdBy", "invitedByName")),
      createdAt: toMs(pick(item, "createdAt", "sentAt", "invitedAt")),
      expiresAt: toMs(item.expiresAt),
    });
  }
  return out;
}

export function parseMemberDetail(json: unknown): MemberDetail | undefined {
  const r = isRecord(json) && isRecord(json.member) ? json.member : json;
  if (!isRecord(r)) return undefined;
  const base = parseMemberBase(r);
  if (!base) return undefined;
  const sessions = list(r.sessions).flatMap((s, i) =>
    isRecord(s)
      ? [
          {
            id: str(s.id, String(i)),
            device: str(pick(s, "device", "label", "userAgent"), "Unknown device"),
            location: str(pick(s, "location", "place")),
            lastActiveAt: toMs(pick(s, "lastActiveAt", "lastSeenAt", "createdAt")),
            current: s.current === true,
          },
        ]
      : [],
  );
  const countRaw = pick(r, "sessionCount", "sessionsCount");
  const twoStep = isRecord(r.twoStep) ? r.twoStep : {};
  return {
    ...base,
    invitedBy: nameOf(pick(r, "invitedBy", "invitedByName")),
    joinedAt: toMs(pick(r, "joinedAt", "createdAt")),
    twoStepSetUpAt: toMs(pick(r, "twoStepSetUpAt", "mfaEnrolledAt") ?? twoStep.setUpAt),
    sessions,
    sessionCount:
      typeof countRaw === "number" ? countRaw : Array.isArray(r.sessions) ? sessions.length : 0,
    lastSignInPlace: str(pick(r, "lastSignInPlace", "lastSignInLocation")),
  };
}

function parseRoleBase(r: Record<string, unknown>): RoleSummary | undefined {
  const id = str(r.id);
  if (!id) return undefined;
  const type = str(r.type);
  const membersRaw = pick(r, "members", "memberCount", "membersCount");
  return {
    id,
    name: str(r.name, id),
    description: str(r.description),
    builtIn:
      r.builtIn === true ||
      r.isSystem === true ||
      r.system === true ||
      type === "built-in" ||
      type === "builtin",
    members:
      typeof membersRaw === "number"
        ? membersRaw
        : Array.isArray(membersRaw)
          ? membersRaw.length
          : 0,
    permissions: parsePermissions(r.permissions),
    updatedAt: toMs(pick(r, "updatedAt", "lastChangedAt")),
    updatedBy: nameOf(pick(r, "updatedBy", "lastChangedBy")),
  };
}

export function parseRoles(json: unknown): RolesList | undefined {
  const raw = isRecord(json) ? json.roles : json;
  if (!Array.isArray(raw)) return undefined;
  const roles: RoleSummary[] = [];
  for (const item of raw) {
    const role = isRecord(item) ? parseRoleBase(item) : undefined;
    if (role) roles.push(role);
  }
  const limit = isRecord(json) ? num(pick(json, "customLimit", "limit"), 20) : 20;
  return { roles, customLimit: limit };
}

const parseRoleMembers = (v: unknown): RoleMember[] =>
  list(v).flatMap((m) =>
    isRecord(m) && str(m.id) ? [{ id: str(m.id), name: str(m.name) || str(m.email) }] : [],
  );

export function parseRoleDetail(json: unknown): RoleDetail | undefined {
  const r = isRecord(json) && isRecord(json.role) ? json.role : json;
  if (!isRecord(r)) return undefined;
  const base = parseRoleBase(r);
  if (!base) return undefined;
  const memberList = parseRoleMembers(
    Array.isArray(r.members)
      ? r.members
      : (r.memberList ?? (isRecord(json) ? json.members : undefined)),
  );
  return { ...base, members: Math.max(base.members, memberList.length), memberList };
}

export function parseRolePreview(json: unknown): RolePreview | undefined {
  if (!isRecord(json)) return undefined;
  const source = isRecord(json.preview) ? json.preview : json;
  const diff = Array.isArray(source.diff)
    ? source.diff.flatMap((d) =>
        isRecord(d)
          ? [{ label: str(pick(d, "label", "area")), before: str(d.before), after: str(d.after) }]
          : [],
      )
    : null;
  const affected = Array.isArray(source.affected) ? parseRoleMembers(source.affected) : null;
  return { diff, affected };
}

export function parseAuditEntry(item: unknown): AuditEntry | undefined {
  if (!isRecord(item) || !str(item.id)) return undefined;
  const actor = isRecord(item.actor) ? item.actor : {};
  const target = isRecord(item.target) ? item.target : {};
  return {
    id: str(item.id),
    at: toMs(pick(item, "at", "createdAt")),
    actorId: str(actor.id),
    actorName:
      str(actor.name) ||
      str(actor.email) ||
      (typeof item.actor === "string" ? item.actor : "System"),
    actorRole: str(actor.role) || str(actor.roleName),
    action: str(item.action),
    targetId: str(target.id) || (typeof item.target === "string" ? item.target : ""),
    targetLabel: str(target.label) || str(target.name) || str(item.targetLabel),
    summary: str(pick(item, "summary", "detail")) || str(target.detail),
    before: str(item.before),
    after: str(item.after),
    confirmedWith: str(pick(item, "confirmedWith", "confirmed")),
    device: str(item.device),
    ip: str(item.ip),
  };
}

export function parseAuditPage(json: unknown): AuditPage | undefined {
  if (!isRecord(json) || !Array.isArray(json.entries)) return undefined;
  const entries: AuditEntry[] = [];
  for (const item of json.entries) {
    const e = parseAuditEntry(item);
    if (e) entries.push(e);
  }
  const next = pick(json, "nextCursor", "cursor");
  return { entries, nextCursor: typeof next === "string" && next ? next : null };
}

export function parseAuditEntryReply(json: unknown): AuditEntry | undefined {
  return parseAuditEntry(isRecord(json) && isRecord(json.entry) ? json.entry : json);
}

export function parseMe(json: unknown): MeInfo | undefined {
  if (!isRecord(json) || !str(json.id)) return undefined;
  const role = isRecord(json.role) ? json.role : {};
  return {
    id: str(json.id),
    name: str(json.name),
    email: str(json.email),
    roleId: str(role.id),
    roleName: str(role.name),
    permissions: parsePermissions(json.permissions),
  };
}

export const parseNothing = (): null => null;
