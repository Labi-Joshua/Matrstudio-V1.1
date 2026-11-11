import { type ApiResult, adminRequest, ignoreBody, isRecord } from "../api";
import type {
  ApproveBody,
  Assignee,
  AutoCheck,
  CheckStatus,
  Counts,
  DeclineReason,
  DuplicateOf,
  LinkReportDetail,
  LinkReportRow,
  Page,
  ProfileReportDetail,
  ProfileReportRow,
  Reporter,
  ReviewerMe,
  SubmissionDetail,
  SubmissionRow,
  SubmitterStats,
} from "./types";

/* Parsers are tolerant of extra fields and return undefined on a wrong shape. */

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function parseAssignee(v: unknown): Assignee {
  if (!isRecord(v) || typeof v.id !== "string") return null;
  return { id: v.id, name: str(v.name, "Someone") };
}

function checkStatus(v: unknown): CheckStatus {
  return v === "pass" || v === "warn" || v === "fail" ? v : "warn";
}

function parseCounts(v: unknown): Counts | null {
  if (!isRecord(v)) return null;
  return {
    submissions: num(v.submissions),
    linkReports: num(v.linkReports),
    profileReports: num(v.profileReports),
  };
}

function parseSubmissionRow(v: unknown): SubmissionRow | undefined {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.title !== "string") return undefined;
  const s = isRecord(v.submitter) ? v.submitter : {};
  const c = isRecord(v.check) ? v.check : {};
  return {
    id: v.id,
    title: v.title,
    source: str(v.source),
    type: str(v.type, "article"),
    submitter: {
      id: str(s.id),
      name: str(s.name, "Unknown"),
      submitted: num(s.submitted),
      approved: num(s.approved),
    },
    check: { status: checkStatus(c.status), label: str(c.label, "Check") },
    ageDays: num(v.ageDays),
    assignedTo: parseAssignee(v.assignedTo),
  };
}

function linkStatusOf(v: unknown): "failed" | "redirects" | "ok" {
  return v === "redirects" || v === "ok" ? v : "failed";
}

function parseLinkRow(v: unknown): LinkReportRow | undefined {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.title !== "string") return undefined;
  return {
    id: v.id,
    title: v.title,
    source: str(v.source),
    usedInPaths: num(v.usedInPaths),
    reportCount: num(v.reportCount, 1),
    reason: str(v.reason),
    linkStatus: linkStatusOf(v.linkStatus),
    ageDays: num(v.ageDays),
    assignedTo: parseAssignee(v.assignedTo),
  };
}

function parseProfileRow(v: unknown): ProfileReportRow | undefined {
  if (!isRecord(v) || typeof v.id !== "string") return undefined;
  return {
    id: v.id,
    name: str(v.name, "Unknown"),
    handle: str(v.handle),
    avatarUrl: strOrNull(v.avatarUrl),
    reason: str(v.reason),
    reportCount: num(v.reportCount, 1),
    ageDays: num(v.ageDays),
    assignedTo: parseAssignee(v.assignedTo),
  };
}

function pageOf<T>(json: unknown, row: (v: unknown) => T | undefined): Page<T> | undefined {
  if (!isRecord(json) || !Array.isArray(json.items)) return undefined;
  const items: T[] = [];
  for (const raw of json.items) {
    const parsed = row(raw);
    if (parsed === undefined) return undefined;
    items.push(parsed);
  }
  return { items, nextCursor: strOrNull(json.nextCursor), counts: parseCounts(json.counts) };
}

function parseStats(v: unknown): SubmitterStats {
  const s = isRecord(v) ? v : {};
  return {
    id: str(s.id),
    name: str(s.name, "Unknown"),
    since: strOrNull(s.since),
    submitted: num(s.submitted),
    approved: num(s.approved),
    declined: num(s.declined),
  };
}

function parseDuplicate(v: unknown): DuplicateOf | null {
  if (!isRecord(v) || typeof v.id !== "string") return null;
  return {
    id: v.id,
    title: str(v.title, "Untitled"),
    url: strOrNull(v.url),
    status: str(v.status, "Live"),
    usedInPaths: num(v.usedInPaths),
  };
}

function parseChecks(v: unknown): AutoCheck[] {
  return list(v).flatMap((c) =>
    isRecord(c) && typeof c.label === "string"
      ? [{ key: str(c.key, c.label), label: c.label, status: checkStatus(c.status) }]
      : [],
  );
}

function parseReporters(v: unknown): Reporter[] {
  return list(v).flatMap((r) =>
    isRecord(r) ? [{ name: str(r.name, "A learner"), when: str(r.when), text: str(r.text) }] : [],
  );
}

function parseSubmissionDetail(json: unknown): SubmissionDetail | undefined {
  const root = isRecord(json) && isRecord(json.submission) ? json.submission : json;
  if (!isRecord(root) || typeof root.id !== "string" || typeof root.title !== "string") {
    return undefined;
  }
  return {
    id: root.id,
    title: root.title,
    url: str(root.url),
    source: str(root.source),
    type: str(root.type, "article"),
    minutes: numOrNull(root.minutes),
    topic: strOrNull(root.topic),
    level: strOrNull(root.level),
    creator: strOrNull(root.creator),
    note: str(root.note),
    ageDays: num(root.ageDays),
    submittedAt: strOrNull(root.submittedAt),
    status: str(root.status, "in_review"),
    submitter: parseStats(root.submitter),
    autoChecks: parseChecks(root.autoChecks),
    duplicateOf: parseDuplicate(root.duplicateOf),
    assignedTo: parseAssignee(root.assignedTo),
  };
}

function parseLinkDetail(json: unknown): LinkReportDetail | undefined {
  const r = isRecord(json) && isRecord(json.report) ? json.report : json;
  if (!isRecord(r) || typeof r.id !== "string") return undefined;
  const lc = isRecord(r.linkCheck) ? r.linkCheck : {};
  return {
    id: r.id,
    resourceId: str(r.resourceId),
    title: str(r.title, "Untitled"),
    url: strOrNull(r.url),
    type: str(r.type, "Resource"),
    reportCount: num(r.reportCount, list(r.reports).length),
    firstReportDays: num(r.firstReportDays),
    linkStatus: linkStatusOf(r.linkStatus),
    reports: parseReporters(r.reports),
    linkCheck: { ok: lc.ok === true, reason: str(lc.reason), checkedText: str(lc.checkedText) },
    usedIn: list(r.usedIn).filter((x): x is string => typeof x === "string"),
    learnersNow: num(r.learnersNow),
    assignedTo: parseAssignee(r.assignedTo),
    resolved: r.resolved === true,
  };
}

function parseProfileDetail(json: unknown): ProfileReportDetail | undefined {
  const r = isRecord(json) && isRecord(json.report) ? json.report : json;
  if (!isRecord(r) || typeof r.id !== "string") return undefined;
  const f = isRecord(r.facts) ? r.facts : {};
  return {
    id: r.id,
    name: str(r.name, "Unknown"),
    handle: str(r.handle),
    avatarUrl: strOrNull(r.avatarUrl),
    profileUrl: strOrNull(r.profileUrl),
    reason: str(r.reason),
    reportCount: num(r.reportCount, list(r.reports).length),
    ageDays: num(r.ageDays),
    bio: str(r.bio),
    links: list(r.links).filter((x): x is string => typeof x === "string"),
    reports: parseReporters(r.reports),
    facts: {
      joined: str(f.joined, "Unknown"),
      pathsStarted: num(f.pathsStarted),
      submissions: num(f.submissions),
      pastReports: num(f.pastReports),
    },
    assignedTo: parseAssignee(r.assignedTo),
    resolved: r.resolved === true,
  };
}

export type ListFilters = {
  assignee?: "me" | "none";
  olderThanDays?: number;
  status?: string;
  topic?: string;
  cursor?: string | null;
};

export function queryOf(filters: ListFilters): string {
  const q = new URLSearchParams();
  if (filters.assignee) q.set("assignee", filters.assignee);
  if (filters.olderThanDays) q.set("olderThanDays", String(filters.olderThanDays));
  if (filters.status) q.set("status", filters.status);
  if (filters.topic) q.set("topic", filters.topic);
  if (filters.cursor) q.set("cursor", filters.cursor);
  const text = q.toString();
  return text ? `?${text}` : "";
}

export const listSubmissions = (f: ListFilters, signal?: AbortSignal) =>
  adminRequest("GET", `/review/submissions${queryOf(f)}`, (j) => pageOf(j, parseSubmissionRow), {
    signal,
  });
export const listLinkReports = (f: ListFilters, signal?: AbortSignal) =>
  adminRequest("GET", `/review/link-reports${queryOf(f)}`, (j) => pageOf(j, parseLinkRow), {
    signal,
  });
export const listProfileReports = (f: ListFilters, signal?: AbortSignal) =>
  adminRequest("GET", `/review/profile-reports${queryOf(f)}`, (j) => pageOf(j, parseProfileRow), {
    signal,
  });

const enc = encodeURIComponent;
export const getSubmission = (id: string, signal?: AbortSignal) =>
  adminRequest("GET", `/review/submissions/${enc(id)}`, parseSubmissionDetail, { signal });
export const getLinkReport = (id: string, signal?: AbortSignal) =>
  adminRequest("GET", `/review/link-reports/${enc(id)}`, parseLinkDetail, { signal });
export const getProfileReport = (id: string, signal?: AbortSignal) =>
  adminRequest("GET", `/review/profile-reports/${enc(id)}`, parseProfileDetail, { signal });

/** A decision may carry the id of the next waiting submission, so the screen can auto-advance. */
const parseNext = (json: unknown): { nextId: string | null } => ({
  nextId: isRecord(json) && typeof json.nextId === "string" ? json.nextId : null,
});

export const approveSubmission = (id: string, body: ApproveBody) =>
  adminRequest("POST", `/review/submissions/${enc(id)}/approve`, parseNext, { body });
export const requestChange = (id: string, message: string) =>
  adminRequest("POST", `/review/submissions/${enc(id)}/request-change`, parseNext, {
    body: { message },
  });
export const declineSubmission = (
  id: string,
  body: { reason: DeclineReason; note?: string; duplicateOf?: string },
) => adminRequest("POST", `/review/submissions/${enc(id)}/decline`, parseNext, { body });

export type AssignKind = "submissions" | "link-reports" | "profile-reports";
const parseAssigned = (json: unknown): { assignedTo: Assignee } => ({
  assignedTo: isRecord(json) ? parseAssignee(json.assignedTo) : null,
});
/** Assigns to the signed-in admin ("me") or clears the assignment (null). */
export const assignItem = (kind: AssignKind, id: string, assignee: "me" | null) =>
  adminRequest("PATCH", `/review/${kind}/${enc(id)}/assign`, parseAssigned, {
    body: { assignee },
  });

export const dismissLinkReport = (id: string) =>
  adminRequest("POST", `/review/link-reports/${enc(id)}/dismiss`, ignoreBody, { body: {} });
export const dismissProfileReport = (id: string) =>
  adminRequest("POST", `/review/profile-reports/${enc(id)}/dismiss`, ignoreBody, { body: {} });
export const hideProfile = (id: string, body: { message: string; notifyReporters: boolean }) =>
  adminRequest("POST", `/review/profile-reports/${enc(id)}/hide-profile`, ignoreBody, { body });

/** Hand-off to the resources endpoint (spec D): fixes the link and can tell the reporters. */
export const fixLink = (resourceId: string, body: { url: string; notifyReporters: boolean }) =>
  adminRequest("POST", `/resources/${enc(resourceId)}/fix-link`, ignoreBody, { body });

/** The signed-in admin: id for "assigned to me", review_queues level for the action buttons. */
export const getReviewer = (signal?: AbortSignal): Promise<ApiResult<ReviewerMe>> =>
  adminRequest(
    "GET",
    "/me",
    (json) => {
      if (!isRecord(json) || typeof json.id !== "string") return undefined;
      const perms = isRecord(json.permissions) ? json.permissions : {};
      return { id: json.id, name: str(json.name), canManage: perms.review_queues === "manage" };
    },
    { signal },
  );
