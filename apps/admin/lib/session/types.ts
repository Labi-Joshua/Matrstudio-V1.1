import { isRecord } from "../api";

/** Mirrors AdminMeResponse in packages/types (kept local: the admin app does not import it). */
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

export type AdminMe = {
  id: string;
  email: string;
  name: string;
  role: { id: string; name: string };
  permissions: AdminPermissions;
  menu: AdminArea[];
  mfaEnrolled: boolean;
  lastReauthAt: number | null;
  fresh: boolean;
  sessionExpiresAt: number;
  sessionAbsoluteExpiresAt: number;
  /** Items waiting in the review queue; 0 when the admin cannot see the queue. */
  reviewBadge: number;
  unreadNotifications: number;
};

const isArea = (v: unknown): v is AdminArea =>
  typeof v === "string" && (ADMIN_AREAS as readonly string[]).includes(v);
const isLevel = (v: unknown): v is AdminLevel => v === "none" || v === "view" || v === "manage";
const count = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

/** Tolerant parser: undefined unless the body is a usable /me answer. */
export function parseMe(json: unknown): AdminMe | undefined {
  if (!isRecord(json)) return undefined;
  const { id, email, name, role, permissions, menu } = json;
  if (typeof id !== "string" || typeof email !== "string" || typeof name !== "string") {
    return undefined;
  }
  if (!isRecord(role) || typeof role.id !== "string" || typeof role.name !== "string") {
    return undefined;
  }
  if (!isRecord(permissions) || !Array.isArray(menu)) return undefined;
  const perms = {} as AdminPermissions;
  for (const area of ADMIN_AREAS) {
    const level = permissions[area];
    perms[area] = isLevel(level) ? level : "none";
  }
  const now = Math.floor(Date.now() / 1000);
  const badges = isRecord(json.badges) ? json.badges : {};
  return {
    id,
    email,
    name,
    role: { id: role.id, name: role.name },
    permissions: perms,
    menu: menu.filter(isArea),
    mfaEnrolled: json.mfaEnrolled === true,
    lastReauthAt: typeof json.lastReauthAt === "number" ? json.lastReauthAt : null,
    fresh: json.fresh === true,
    sessionExpiresAt:
      typeof json.sessionExpiresAt === "number" ? json.sessionExpiresAt : now + 1800,
    sessionAbsoluteExpiresAt:
      typeof json.sessionAbsoluteExpiresAt === "number"
        ? json.sessionAbsoluteExpiresAt
        : now + 8 * 3600,
    reviewBadge: count(badges.review),
    unreadNotifications: count(json.unreadNotifications),
  };
}

/** `me` as returned by sign-in/mfa and invite/enrol: `{ admin }`. */
export function parseAdminWrapper(
  json: unknown,
): { admin: AdminMe; rest: Record<string, unknown> } | undefined {
  if (!isRecord(json)) return undefined;
  const admin = parseMe(json.admin);
  return admin ? { admin, rest: json } : undefined;
}

/** First name for greetings and the profile menu. */
export const firstName = (me: Pick<AdminMe, "name" | "email">): string =>
  me.name.trim().split(/\s+/)[0] || me.email.split("@")[0] || "there";

export function initials(me: Pick<AdminMe, "name" | "email">): string {
  const words = me.name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length >= 2
      ? `${words[0]?.[0] ?? ""}${words[words.length - 1]?.[0] ?? ""}`
      : (words[0]?.slice(0, 2) ?? me.email.slice(0, 2));
  return letters.toUpperCase();
}
