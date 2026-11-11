import { type ApiResult, adminRequest, ignoreBody, isRecord } from "../api";
import {
  type Access,
  parseAccess,
  parseBatches,
  parseStats,
  parseSupportList,
  parseTicketDetail,
  parseUserDetail,
  parseUserList,
  parseWaitlist,
} from "./parse";
import type {
  Batch,
  ExportResult,
  Severity,
  SupportKind,
  SupportList,
  SupportTab,
  TicketDetail,
  UserDetail,
  UserFilter,
  UserList,
  WaitlistFilter,
  WaitlistList,
  WaitlistStats,
} from "./types";

/**
 * Typed calls for the People area (spec section D: Users and waitlist, Support). Every function
 * resolves to an ApiResult. Paths are relative to /api/admin. The contract is documented in
 * the shapes the parsers in parse.ts accept (listed in the build report).
 */

export type Page = { cursor?: string | null; signal?: AbortSignal };

const qs = (params: Record<string, string | null | undefined | false>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
};
const id = encodeURIComponent;

export const getAccess = (signal?: AbortSignal): Promise<ApiResult<Access>> =>
  adminRequest("GET", "/me", parseAccess, { signal });

// --- Users -----------------------------------------------------------------------------------

export const listUsers = (
  q: { search: string; status: UserFilter } & Page,
): Promise<ApiResult<UserList>> =>
  adminRequest(
    "GET",
    `/users${qs({ q: q.search.trim(), status: q.status !== "all" && q.status, cursor: q.cursor })}`,
    parseUserList,
    { signal: q.signal },
  );

export const getUser = (userId: string, signal?: AbortSignal): Promise<ApiResult<UserDetail>> =>
  adminRequest("GET", `/users/${id(userId)}`, parseUserDetail, { signal });

export const sendResetLink = (userId: string) =>
  adminRequest("POST", `/users/${id(userId)}/reset-link`, ignoreBody);

export const suspendUser = (userId: string, body: { reason: string; message: string }) =>
  adminRequest("POST", `/users/${id(userId)}/suspend`, ignoreBody, { body });

export const restoreUser = (userId: string) =>
  adminRequest("POST", `/users/${id(userId)}/restore`, ignoreBody);

/** Asks for a copy of the person's data. The API either queues an email or returns the data. */
export const exportUser = (userId: string): Promise<ApiResult<ExportResult>> =>
  adminRequest("POST", `/users/${id(userId)}/export`, (json): ExportResult => {
    const r = isRecord(json) ? json : {};
    return { queued: r.queued === true, data: r.data ?? null };
  });

/** Super admin only, and needs a fresh sign-in check: a 401 reauth_required means "ask for it". */
export const deleteUser = (userId: string, body: { confirm: string; emailCopy: boolean }) =>
  adminRequest("DELETE", `/users/${id(userId)}`, ignoreBody, { body });

/** Step-up check used before delete (same call as the sign-in confirm). */
export const reauth = (body: { password: string; code: string }) =>
  adminRequest("POST", "/reauth", ignoreBody, { body });

// --- Waitlist --------------------------------------------------------------------------------

export const getWaitlistStats = (signal?: AbortSignal): Promise<ApiResult<WaitlistStats>> =>
  adminRequest("GET", "/waitlist/stats", parseStats, { signal });

export const listWaitlist = (
  q: { status: WaitlistFilter } & Page,
): Promise<ApiResult<WaitlistList>> =>
  adminRequest(
    "GET",
    `/waitlist${qs({ status: q.status !== "all" && q.status, cursor: q.cursor })}`,
    parseWaitlist,
    { signal: q.signal },
  );

export const getBatches = (signal?: AbortSignal): Promise<ApiResult<Batch[]>> =>
  adminRequest("GET", "/waitlist/batches", parseBatches, { signal });

/** Invites the oldest `count` people who are still waiting. */
export const sendInvites = (count: number): Promise<ApiResult<{ sent: number }>> =>
  adminRequest(
    "POST",
    "/waitlist/invites",
    (json) => {
      const sent = isRecord(json) && typeof json.sent === "number" ? json.sent : undefined;
      return sent === undefined ? undefined : { sent };
    },
    { body: { count } },
  );

export const remindBatch = (batchId: string): Promise<ApiResult<{ reminded: number }>> =>
  adminRequest("POST", `/waitlist/batches/${id(batchId)}/remind`, (json) => {
    const n = isRecord(json) && typeof json.reminded === "number" ? json.reminded : undefined;
    return n === undefined ? undefined : { reminded: n };
  });

// --- Support ---------------------------------------------------------------------------------

export type SupportQuery = {
  tab: SupportTab;
  kind: SupportKind | null;
  mine: boolean;
  overdue: boolean;
} & Page;

export const listSupport = (q: SupportQuery): Promise<ApiResult<SupportList>> =>
  adminRequest(
    "GET",
    `/support${qs({
      tab: q.tab,
      kind: q.kind,
      assigned: q.mine && "me",
      overdue: q.overdue && "1",
      cursor: q.cursor,
    })}`,
    parseSupportList,
    { signal: q.signal },
  );

export const getTicket = (
  ticketId: string,
  signal?: AbortSignal,
): Promise<ApiResult<TicketDetail>> =>
  adminRequest("GET", `/support/${id(ticketId)}`, parseTicketDetail, { signal });

export const replyToTicket = (ticketId: string, message: string) =>
  adminRequest("POST", `/support/${id(ticketId)}/reply`, ignoreBody, { body: { message } });

export const addNote = (ticketId: string, body: string) =>
  adminRequest("POST", `/support/${id(ticketId)}/note`, ignoreBody, { body: { body } });

export type StatusChange =
  | { status: "open" | "waiting_on_user" | "resolved" }
  | { status: "fixed" | "cant_reproduce"; message: string };

export const setTicketStatus = (ticketId: string, change: StatusChange) =>
  adminRequest("POST", `/support/${id(ticketId)}/status`, ignoreBody, { body: change });

export const assignTicket = (ticketId: string, to: "me" | "nobody") =>
  adminRequest("POST", `/support/${id(ticketId)}/assign`, ignoreBody, { body: { to } });

export type LogIssue = {
  title: string;
  description: string;
  severity: Severity;
  area: string;
  linkReportId?: string;
  notifyRequester: boolean;
};

export const logIssue = (
  ticketId: string,
  body: LogIssue,
): Promise<ApiResult<{ issueId: number }>> =>
  adminRequest(
    "POST",
    `/support/${id(ticketId)}/log`,
    (json) => {
      const n = isRecord(json) && typeof json.issueId === "number" ? json.issueId : undefined;
      return n === undefined ? undefined : { issueId: n };
    },
    { body },
  );
