import { type ApiResult, adminRequest } from "../api";
import {
  parseAuditEntryReply,
  parseAuditPage,
  parseInvites,
  parseMe,
  parseMemberDetail,
  parseMembers,
  parseNothing,
  parseRoleDetail,
  parseRolePreview,
  parseRoles,
} from "./parse";
import type {
  AuditEntry,
  AuditPage,
  Invite,
  MeInfo,
  Member,
  MemberDetail,
  Permissions,
  RoleDetail,
  RolePreview,
  RolesList,
} from "./types";

/** Endpoints of ADMIN-SPEC section D (Admin team, Roles, Audit), one function each. */
const enc = encodeURIComponent;

export const getMe = (): Promise<ApiResult<MeInfo>> => adminRequest("GET", "/me", parseMe);

export const getTeam = (): Promise<ApiResult<Member[]>> =>
  adminRequest("GET", "/team", parseMembers);
export const getInvites = (): Promise<ApiResult<Invite[]>> =>
  adminRequest("GET", "/team/invites", parseInvites);
export const getMember = (id: string): Promise<ApiResult<MemberDetail>> =>
  adminRequest("GET", `/team/${enc(id)}`, parseMemberDetail);

export const inviteAdmin = (body: { email: string; roleId: string; name?: string }) =>
  adminRequest("POST", "/team/invite", parseNothing, { body });
export const cancelInvite = (id: string) =>
  adminRequest("POST", `/team/invites/${enc(id)}/cancel`, parseNothing);
export const resendInvite = (id: string) =>
  adminRequest("POST", `/team/invites/${enc(id)}/resend`, parseNothing);

/** One role per admin: the body keeps the contract's `roleIds` array with a single entry. */
export const setMemberRole = (id: string, roleId: string, twoStepCode?: string) =>
  adminRequest("PUT", `/team/${enc(id)}/roles`, parseNothing, {
    body: { roleIds: [roleId], ...(twoStepCode ? { twoStepCode } : {}) },
  });
/** `until` is an ISO time; null makes access permanent again. */
export const setTemporaryAccess = (id: string, until: string | null) =>
  adminRequest("POST", `/team/${enc(id)}/temporary-access`, parseNothing, { body: { until } });
export const suspendMember = (id: string, reason: string) =>
  adminRequest("POST", `/team/${enc(id)}/suspend`, parseNothing, { body: { reason } });
export const restoreMember = (id: string) =>
  adminRequest("POST", `/team/${enc(id)}/restore`, parseNothing);
export const unlockMember = (id: string) =>
  adminRequest("POST", `/team/${enc(id)}/unlock`, parseNothing);
export const signOutEverywhere = (id: string) =>
  adminRequest("POST", `/team/${enc(id)}/sign-out-everywhere`, parseNothing);
export const removeMember = (id: string) =>
  adminRequest("DELETE", `/team/${enc(id)}`, parseNothing);

type RoleBody = { name: string; description?: string; permissions: Permissions };

export const getRoles = (): Promise<ApiResult<RolesList>> =>
  adminRequest("GET", "/roles", parseRoles);
export const getRole = (id: string): Promise<ApiResult<RoleDetail>> =>
  adminRequest("GET", `/roles/${enc(id)}`, parseRoleDetail);
export const createRole = (body: RoleBody) =>
  adminRequest("POST", "/roles", parseRoleDetail, { body });
export const updateRole = (id: string, body: RoleBody) =>
  adminRequest("PUT", `/roles/${enc(id)}`, parseNothing, { body });
export const previewRoleUpdate = (id: string, body: RoleBody): Promise<ApiResult<RolePreview>> =>
  adminRequest("PUT", `/roles/${enc(id)}?preview=1`, parseRolePreview, { body });
export const duplicateRole = (id: string, name?: string) =>
  adminRequest("POST", `/roles/${enc(id)}/duplicate`, parseRoleDetail, {
    body: name ? { name } : {},
  });
export const deleteRole = (id: string, moveMembersTo?: string) =>
  adminRequest("DELETE", `/roles/${enc(id)}`, parseNothing, {
    body: moveMembersTo ? { moveMembersTo } : {},
  });

export type AuditQuery = {
  q?: string;
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
  cursor?: string;
};

export function auditQueryString(query: AuditQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const getAudit = (query: AuditQuery): Promise<ApiResult<AuditPage>> =>
  adminRequest("GET", `/audit${auditQueryString(query)}`, parseAuditPage);
export const getAuditEntry = (id: string): Promise<ApiResult<AuditEntry>> =>
  adminRequest("GET", `/audit/${enc(id)}`, parseAuditEntryReply);

/** CSV export of the current filters. Returns the file as a Blob, or a failure the UI can show. */
export async function exportAudit(
  query: AuditQuery,
): Promise<{ ok: true; blob: Blob } | { ok: false; message: string }> {
  try {
    const response = await fetch(
      `/api/admin/audit/export${auditQueryString({ ...query, cursor: undefined })}`,
      { credentials: "include", cache: "no-store" },
    );
    if (!response.ok) return { ok: false, message: "The export didn’t start. Try again." };
    return { ok: true, blob: await response.blob() };
  } catch {
    return { ok: false, message: "We couldn’t reach the server." };
  }
}
