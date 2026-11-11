import { type ApiResult, adminRequest, ignoreBody, isRecord } from "../api";
import { type AdminMe, parseAdminWrapper, parseMe } from "./types";

/** Typed calls of the shell, sign-in and invite flows (shapes: routes/admin.ts, ADMIN-AUTH.md). */

export const getMe = (signal?: AbortSignal) => adminRequest("GET", "/me", parseMe, { signal });

export const signIn = (email: string, password: string) =>
  adminRequest(
    "POST",
    "/sign-in",
    (j) => (isRecord(j) && j.status === "mfa_required" ? true : undefined),
    {
      body: { email, password },
    },
  );

export type MfaDone = { admin: AdminMe; backupCodesRemaining: number };
export const submitMfa = (code: string): Promise<ApiResult<MfaDone>> =>
  adminRequest(
    "POST",
    "/sign-in/mfa",
    (j) => {
      const w = parseAdminWrapper(j);
      if (!w) return undefined;
      const left = w.rest.backupCodesRemaining;
      return { admin: w.admin, backupCodesRemaining: typeof left === "number" ? left : 0 };
    },
    { body: { code } },
  );

export const signOutRequest = () => adminRequest("POST", "/sign-out", ignoreBody);

export const reauth = (password: string, code: string) =>
  adminRequest(
    "POST",
    "/reauth",
    (j) => (isRecord(j) && typeof j.lastReauthAt === "number" ? j.lastReauthAt : undefined),
    { body: { password, code } },
  );

export type InviteCheck = { emailHint: string; role: string; expiresAt: number };
export type InviteProblem = {
  code: string;
  message: string;
  status?: number;
  invitedBy: string | null;
  invitedAt: number | null;
  retryAfterSeconds?: number;
};

/**
 * GET /invite/check. Written with fetch rather than adminRequest because the expired and cancelled
 * answers carry `invitedBy` and `invitedAt` next to the code, which the screen shows.
 */
export async function checkInvite(
  token: string,
): Promise<{ ok: true; data: InviteCheck } | ({ ok: false } & InviteProblem)> {
  const fail = (extra: Partial<InviteProblem> = {}) => ({
    ok: false as const,
    code: "network_error",
    message: "We couldn’t reach the server.",
    invitedBy: null,
    invitedAt: null,
    ...extra,
  });
  let response: Response;
  try {
    response = await fetch(`/api/admin/invite/check?token=${encodeURIComponent(token)}`, {
      credentials: "include",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
  } catch {
    return fail();
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    json = undefined;
  }
  const body = isRecord(json) ? json : {};
  if (!response.ok) {
    return fail({
      code: typeof body.code === "string" ? body.code : "unknown_error",
      message: typeof body.message === "string" ? body.message : "Something went wrong.",
      status: response.status,
      invitedBy: typeof body.invitedBy === "string" ? body.invitedBy : null,
      invitedAt: typeof body.invitedAt === "number" ? body.invitedAt : null,
      retryAfterSeconds:
        typeof body.retryAfterSeconds === "number" ? body.retryAfterSeconds : undefined,
    });
  }
  if (
    body.status === "ok" &&
    typeof body.emailHint === "string" &&
    typeof body.role === "string" &&
    typeof body.expiresAt === "number"
  ) {
    return {
      ok: true,
      data: { emailHint: body.emailHint, role: body.role, expiresAt: body.expiresAt },
    };
  }
  return fail({ code: "invalid_response", message: "The server sent a reply we couldn’t read." });
}

export type Enrolment = { otpauthUri: string; secretKey: string };
export const acceptInvite = (token: string, password: string, name?: string) =>
  adminRequest(
    "POST",
    "/invite/accept",
    (j): Enrolment | undefined =>
      isRecord(j) &&
      j.step === "mfa" &&
      typeof j.otpauthUri === "string" &&
      typeof j.secretKey === "string"
        ? { otpauthUri: j.otpauthUri, secretKey: j.secretKey }
        : undefined,
    { body: name ? { token, password, name } : { token, password } },
  );

export type Enrolled = { admin: AdminMe; backupCodes: string[] };
export const enrolInvite = (token: string, code: string): Promise<ApiResult<Enrolled>> =>
  adminRequest(
    "POST",
    "/invite/enrol",
    (j) => {
      const w = parseAdminWrapper(j);
      const codes = w?.rest.backupCodes;
      if (!w || !Array.isArray(codes)) return undefined;
      return {
        admin: w.admin,
        backupCodes: codes.filter((c): c is string => typeof c === "string"),
      };
    },
    { body: { token, code } },
  );

// --- notifications and search (shapes: AdminNotificationsResponse / AdminSearchResponse) --------

export type AdminNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  read: boolean;
};
export type NotificationsData = { notifications: AdminNotification[]; unread: number };

export function parseNotifications(json: unknown): NotificationsData | undefined {
  if (!isRecord(json) || !Array.isArray(json.notifications)) return undefined;
  const notifications: AdminNotification[] = [];
  for (const raw of json.notifications) {
    if (!isRecord(raw) || typeof raw.title !== "string") continue;
    if (typeof raw.id !== "number" && typeof raw.id !== "string") continue;
    notifications.push({
      id: String(raw.id),
      kind: typeof raw.kind === "string" ? raw.kind : "info",
      title: raw.title,
      body: typeof raw.body === "string" ? raw.body : "",
      href:
        typeof raw.href === "string" && raw.href.startsWith("/") && !raw.href.startsWith("//")
          ? raw.href
          : null,
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
      read: raw.read === true,
    });
  }
  const unread =
    typeof json.unread === "number" ? json.unread : notifications.filter((n) => !n.read).length;
  return { notifications, unread };
}

export const getNotifications = (signal?: AbortSignal) =>
  adminRequest("GET", "/notifications", parseNotifications, { signal });
export const markAllNotificationsRead = () =>
  adminRequest("POST", "/notifications/read-all", ignoreBody);

export type SearchGroupId = "users" | "resources" | "paths" | "submissions";
export type SearchHit = { group: SearchGroupId; id: string; title: string; detail: string };
export type SearchData = Record<SearchGroupId, SearchHit[]>;

const text = (v: unknown): string => (typeof v === "string" ? v : "");

export function parseSearch(json: unknown): SearchData | undefined {
  if (!isRecord(json)) return undefined;
  const list = (
    key: SearchGroupId,
    map: (r: Record<string, unknown>) => Omit<SearchHit, "group"> | null,
  ) => {
    const raw = json[key];
    const out: SearchHit[] = [];
    if (Array.isArray(raw)) {
      for (const r of raw) {
        const hit = isRecord(r) ? map(r) : null;
        if (hit) out.push({ group: key, ...hit });
      }
    }
    return out;
  };
  const id = (r: Record<string, unknown>) =>
    typeof r.id === "string" || typeof r.id === "number" ? String(r.id) : "";
  return {
    users: list("users", (r) =>
      id(r) && text(r.name) ? { id: id(r), title: text(r.name), detail: text(r.email) } : null,
    ),
    resources: list("resources", (r) =>
      id(r) && text(r.title) ? { id: id(r), title: text(r.title), detail: text(r.status) } : null,
    ),
    paths: list("paths", (r) =>
      id(r) && text(r.title) ? { id: id(r), title: text(r.title), detail: text(r.status) } : null,
    ),
    submissions: list("submissions", (r) =>
      id(r) && text(r.title) ? { id: id(r), title: text(r.title), detail: text(r.status) } : null,
    ),
  };
}

export const searchAdmin = (query: string, signal?: AbortSignal) =>
  adminRequest("GET", `/search?q=${encodeURIComponent(query)}`, parseSearch, { signal });
