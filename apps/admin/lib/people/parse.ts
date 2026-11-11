import { isRecord } from "../api";
import type {
  Batch,
  PathProgress,
  Severity,
  SupportList,
  ThreadMessage,
  TicketDetail,
  TicketRow,
  TicketStatus,
  UserDetail,
  UserList,
  UserRow,
  UserSubmission,
  UserTicket,
  WaitlistEntry,
  WaitlistList,
  WaitlistStats,
} from "./types";

/** Tolerant parsers: a wrong shape gives undefined (the caller shows "couldn't read"), never a throw. */

type R = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const numOr = (v: unknown, d: number): number => num(v) ?? d;
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;

/** Parses each row; any bad row makes the whole list undefined. */
function rows<T>(v: unknown, one: (r: R) => T | undefined): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: T[] = [];
  for (const item of v) {
    const parsed = isRecord(item) ? one(item) : undefined;
    if (!parsed) return undefined;
    out.push(parsed);
  }
  return out;
}

const USER_STATUSES = ["active", "unconfirmed", "suspended"] as const;

function userRow(r: R): UserRow | undefined {
  const id = str(r.id);
  const email = str(r.email);
  const status = oneOf(r.status, USER_STATUSES);
  const joinedAt = str(r.joinedAt);
  if (!id || !email || !status || !joinedAt) return undefined;
  return {
    id,
    email,
    status,
    joinedAt,
    name: str(r.name) || email,
    lastSignInAt: strOrNull(r.lastSignInAt),
    pathsCount: numOr(r.pathsCount, 0),
  };
}

export function parseUserList(json: unknown): UserList | undefined {
  if (!isRecord(json)) return undefined;
  const users = rows(json.users, userRow);
  if (!users) return undefined;
  const totals = isRecord(json.totals) ? json.totals : {};
  return {
    users,
    nextCursor: strOrNull(json.nextCursor),
    totals: { learners: num(totals.learners) ?? null, waitlist: num(totals.waitlist) ?? null },
  };
}

function pathProgress(r: R): PathProgress | undefined {
  const id = str(r.id);
  const title = str(r.title);
  const state = oneOf(r.state, ["in_progress", "completed", "saved"] as const);
  if (!id || !title || !state) return undefined;
  return {
    id,
    title,
    state,
    lessonsDone: numOr(r.lessonsDone, 0),
    lessonsTotal: numOr(r.lessonsTotal, 0),
    percent: numOr(r.percent, 0),
    finishedAt: strOrNull(r.finishedAt),
  };
}

function userSubmission(r: R): UserSubmission | undefined {
  const id = str(r.id);
  const title = str(r.title);
  const status = oneOf(r.status, ["approved", "in_review", "declined", "needs_changes"] as const);
  if (!id || !title || !status) return undefined;
  return { id, title, status, at: strOrNull(r.at) };
}

function userTicket(r: R): UserTicket | undefined {
  const id = str(r.id);
  const subject = str(r.subject);
  if (!id || !subject) return undefined;
  return {
    id,
    subject,
    kind: r.kind === "report" ? "report" : "support",
    status: str(r.status) ?? "open",
    at: strOrNull(r.at),
  };
}

export function parseUserDetail(json: unknown): UserDetail | undefined {
  const r = isRecord(json) && isRecord(json.user) ? json.user : undefined;
  if (!r) return undefined;
  const base = userRow({ ...r, pathsCount: 0 });
  if (!base) return undefined;
  const paths = rows(r.paths ?? [], pathProgress);
  const submissions = rows(r.submissions ?? [], userSubmission);
  const tickets = rows(r.tickets ?? [], userTicket);
  if (!paths || !submissions || !tickets) return undefined;
  const s = isRecord(r.suspension) ? r.suspension : undefined;
  const h = isRecord(r.profileHidden) ? r.profileHidden : undefined;
  return {
    id: base.id,
    name: base.name,
    email: base.email,
    status: base.status,
    joinedAt: base.joinedAt,
    lastSignInAt: base.lastSignInAt,
    emailConfirmedAt: strOrNull(r.emailConfirmedAt),
    authMethod: oneOf(r.authMethod, ["password", "google", "both"] as const) ?? "password",
    suspension:
      s && str(s.at)
        ? { at: str(s.at) ?? "", by: str(s.by) ?? "an admin", reason: str(s.reason) ?? "" }
        : null,
    profileHidden:
      h && str(h.at)
        ? { at: str(h.at) ?? "", reason: str(h.reason) ?? "", reports: numOr(h.reports, 0) }
        : null,
    paths,
    submissions,
    tickets,
  };
}

export function parseStats(json: unknown): WaitlistStats | undefined {
  if (!isRecord(json)) return undefined;
  const waiting = num(json.waiting);
  const invited = num(json.invited);
  if (waiting === undefined || invited === undefined) return undefined;
  return {
    waiting,
    invited,
    oldestWaitingAt: strOrNull(json.oldestWaitingAt),
    lastBatchAt: strOrNull(json.lastBatchAt),
    created: numOr(json.created, 0),
    confirmed: numOr(json.confirmed, 0),
  };
}

function entry(r: R): WaitlistEntry | undefined {
  const id = str(r.id);
  const email = str(r.email);
  const joinedAt = str(r.joinedAt);
  const status = oneOf(r.status, ["waiting", "invited", "created", "confirmed"] as const);
  if (!id || !email || !joinedAt || !status) return undefined;
  return { id, email, joinedAt, status, source: strOrNull(r.source) };
}

export function parseWaitlist(json: unknown): WaitlistList | undefined {
  if (!isRecord(json)) return undefined;
  const entries = rows(json.entries, entry);
  return entries ? { entries, nextCursor: strOrNull(json.nextCursor) } : undefined;
}

function batch(r: R): Batch | undefined {
  const id = str(r.id);
  const sentAt = str(r.sentAt);
  const invited = num(r.invited);
  if (!id || !sentAt || invited === undefined) return undefined;
  return {
    id,
    sentAt,
    invited,
    created: numOr(r.created, 0),
    confirmed: numOr(r.confirmed, 0),
    notJoined: numOr(r.notJoined, 0),
    reminderSentAt: strOrNull(r.reminderSentAt),
  };
}

export const parseBatches = (json: unknown): Batch[] | undefined =>
  isRecord(json) ? rows(json.batches, batch) : undefined;

const STATUSES = [
  "open",
  "replied",
  "waiting_on_user",
  "resolved",
  "fixed",
  "cant_reproduce",
] as const;

function ticketRow(r: R): TicketRow | undefined {
  const id = str(r.id);
  const subject = str(r.subject);
  const status = oneOf(r.status, STATUSES);
  const createdAt = str(r.createdAt);
  const who = isRecord(r.requester) ? r.requester : {};
  if (!id || !subject || !status || !createdAt) return undefined;
  return {
    id,
    subject,
    status,
    createdAt,
    snippet: str(r.snippet) ?? "",
    requester: { name: str(who.name) ?? "Learner", email: str(who.email) ?? "" },
    kind: r.kind === "report" ? "report" : "support",
    category: str(r.category) ?? "",
    isNew: r.isNew === true,
    logged: r.logged === true,
    dueAt: strOrNull(r.dueAt),
    overdue: r.overdue === true,
    assignedToMe: r.assignedToMe === true,
  };
}

export function parseSupportList(json: unknown): SupportList | undefined {
  if (!isRecord(json)) return undefined;
  const tickets = rows(json.tickets, ticketRow);
  if (!tickets) return undefined;
  const c = isRecord(json.counts) ? json.counts : {};
  return {
    tickets,
    nextCursor: strOrNull(json.nextCursor),
    counts: {
      open: num(c.open) ?? null,
      waiting: num(c.waiting) ?? null,
      resolved: num(c.resolved) ?? null,
    },
  };
}

function message(r: R): ThreadMessage | undefined {
  const id = str(r.id);
  const body = str(r.body);
  const at = str(r.at);
  const author = oneOf(r.author, ["learner", "staff", "note"] as const);
  if (!id || body === undefined || !at || !author) return undefined;
  return {
    id,
    body,
    at,
    author,
    name: str(r.name) ?? (author === "learner" ? "Learner" : "You"),
    channel: strOrNull(r.channel),
  };
}

export function parseTicketDetail(json: unknown): TicketDetail | undefined {
  const r = isRecord(json) && isRecord(json.ticket) ? json.ticket : undefined;
  if (!r) return undefined;
  const id = str(r.id);
  const subject = str(r.subject);
  const status = oneOf(r.status, STATUSES);
  const createdAt = str(r.createdAt);
  const messages = rows(r.messages ?? [], message);
  if (!id || !subject || !status || !createdAt || !messages) return undefined;
  const who = isRecord(r.requester) ? r.requester : {};
  const a = isRecord(r.assignee) && str(r.assignee.id) ? r.assignee : null;
  const i = isRecord(r.issue) && num(r.issue.id) !== undefined ? r.issue : null;
  const l = isRecord(r.linkReport) && str(r.linkReport.id) ? r.linkReport : null;
  const severity = (i && oneOf(i.severity, ["low", "medium", "high"] as const)) as
    | Severity
    | undefined;
  return {
    id,
    subject,
    status,
    createdAt,
    messages,
    kind: r.kind === "report" ? "report" : "support",
    category: str(r.category) ?? "",
    isNew: r.isNew === true,
    dueAt: strOrNull(r.dueAt),
    overdue: r.overdue === true,
    assignee: a ? { id: str(a.id) ?? "", name: str(a.name) ?? "Someone" } : null,
    assignedToMe: r.assignedToMe === true,
    requester: {
      id: strOrNull(who.id),
      name: str(who.name) ?? "Learner",
      email: str(who.email) ?? "",
      joinedAt: strOrNull(who.joinedAt),
      paths: strOrNull(who.paths),
      pastTotal: numOr(who.pastTotal, 0),
      pastResolved: numOr(who.pastResolved, 0),
    },
    attached: Array.isArray(r.attached)
      ? r.attached.filter((x): x is string => typeof x === "string")
      : [],
    issue: i
      ? { id: num(i.id) ?? 0, title: str(i.title) ?? "", severity: severity ?? "medium" }
      : null,
    linkReport: l
      ? { id: str(l.id) ?? "", title: str(l.title) ?? "", reports: numOr(l.reports, 0) }
      : null,
    autoResolveDays: num(r.autoResolveDays) ?? null,
  };
}

/** The part of GET /me this area needs. */
export type Access = {
  superAdmin: boolean;
  users: "none" | "view" | "manage";
  support: "none" | "view" | "manage";
};

export function parseAccess(json: unknown): Access | undefined {
  if (!isRecord(json) || !isRecord(json.role) || !isRecord(json.permissions)) return undefined;
  const level = (v: unknown) => oneOf(v, ["none", "view", "manage"] as const) ?? "none";
  return {
    superAdmin: json.role.id === "super_admin",
    users: level(json.permissions.users_waitlist),
    support: level(json.permissions.support_inbox),
  };
}

export type { TicketStatus };
