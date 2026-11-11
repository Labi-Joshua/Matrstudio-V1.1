import { canAdmin, loadPermissions } from "../auth/admin-perms";
import { hostOf, nowSec } from "./common";
import { type PageMeta, parseMeta, safeFetch, suggestType } from "./safe-fetch";

export type QueueTargets = {
  submissionDays: number;
  linkReportDays: number;
  firstReplyDays: number;
  autoResolveDays: number;
  workingDays: string[];
};
export const DEFAULT_TARGETS: QueueTargets = {
  submissionDays: 3,
  linkReportDays: 3,
  firstReplyDays: 2,
  autoResolveDays: 7,
  workingDays: ["mon", "tue", "wed", "thu", "fri"],
};

/** Stored value merged over the defaults (a missing or broken row gives the defaults). */
export async function loadTargets(db: D1Database): Promise<QueueTargets> {
  const row = await db
    .prepare("SELECT value FROM settings_kv WHERE key = 'queue_targets'")
    .first<{ value: string }>();
  try {
    return { ...DEFAULT_TARGETS, ...(JSON.parse(row?.value ?? "{}") as Partial<QueueTargets>) };
  } catch {
    return DEFAULT_TARGETS;
  }
}

export const ageDays = (createdAt: number, now = nowSec()) => Math.floor((now - createdAt) / 86400);
export const isOverdue = (createdAt: number, targetDays: number, now = nowSec()) =>
  now - createdAt > targetDays * 86400;

/** Names for admin ids (assignees). */
export async function adminNames(db: D1Database, ids: Array<string | null>) {
  const out = new Map<string, string>();
  for (const id of new Set(ids.filter((i): i is string => !!i))) {
    const r = await db
      .prepare("SELECT name FROM admin_users WHERE id = ?")
      .bind(id)
      .first<{ name: string }>();
    if (r) out.set(id, r.name);
  }
  return out;
}

/** An assignee must be an active admin who can manage review queues. */
export async function validAssignee(db: D1Database, id: string): Promise<boolean> {
  const a = await db
    .prepare("SELECT role_id FROM admin_users WHERE id = ? AND status = 'active'")
    .bind(id)
    .first<{ role_id: string }>();
  if (!a) return false;
  return canAdmin(await loadPermissions(db, a.role_id), "review_queues", "manage");
}

export type AutoCheck = {
  key: "link_works" | "free_to_read" | "not_in_library" | "language";
  name: string;
  status: "pass" | "fail" | "warn" | "unknown";
  detail?: string;
};

/**
 * Auto-checks shown on a submission. "Free to read, no sign-up" cannot be decided by a machine, so
 * it is always "unknown" (check by hand). A failed fetch leaves link and language "unknown" when the
 * site only refuses bots, "fail" when the page really is not there.
 */
export async function autoChecks(
  url: string,
  duplicate: { id: string; title: string } | null,
  fetchPage: boolean,
): Promise<{ checks: AutoCheck[]; meta: PageMeta }> {
  let meta: PageMeta = {
    title: null,
    siteName: null,
    thumbnail: null,
    durationMin: null,
    lang: null,
  };
  const checks: AutoCheck[] = [];
  if (fetchPage) {
    const page = await safeFetch(url, { readBody: true });
    meta = parseMeta(page.html, page.finalUrl ?? url);
    checks.push({
      key: "link_works",
      name: "Link works",
      status: page.ok ? (page.inconclusive ? "unknown" : "pass") : "fail",
      ...(page.reason ? { detail: page.reason } : {}),
    });
  } else checks.push({ key: "link_works", name: "Link works", status: "unknown" });
  checks.push({
    key: "free_to_read",
    name: "Free to read, no sign-up",
    status: "unknown",
    detail: "Check by hand.",
  });
  checks.push(
    duplicate
      ? {
          key: "not_in_library",
          name: "Not in the library yet",
          status: "warn",
          detail: `Possible duplicate: “${duplicate.title}” is already in the library.`,
        }
      : { key: "not_in_library", name: "Not in the library yet", status: "pass" },
  );
  checks.push(
    meta.lang
      ? {
          key: "language",
          name: meta.lang.startsWith("en") ? "Language: English" : `Language: ${meta.lang}`,
          status: meta.lang.startsWith("en") ? "pass" : "warn",
        }
      : { key: "language", name: "Language", status: "unknown", detail: "The page doesn’t say." },
  );
  return { checks, meta };
}

export const DECLINE_COPY: Record<string, string> = {
  duplicate: "it’s already in the library.",
  not_a_fit: "it isn’t a good fit for what we teach.",
  low_quality: "it didn’t meet our quality bar.",
  not_free: "it isn’t free to read without signing up or paying.",
  other: "it didn’t meet what we’re looking for.",
};

/** "today", "1 day ago", "5 days ago". */
export function relativeDays(at: number, now = nowSec()): string {
  const d = Math.max(0, Math.floor((now - at) / 86400));
  return d === 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}

export const PROFILE_REASON: Record<string, string> = {
  spam: "Spam or scam links",
  abusive: "Abusive or hateful",
  impersonation: "Pretending to be someone else",
  other: "Something else",
};

export type SubRow = {
  id: string;
  user_id: string;
  url: string;
  url_normalised: string;
  title: string | null;
  note: string | null;
  topic: string | null;
  status: string;
  curator_note: string | null;
  assigned_to: string | null;
  decline_reason: string | null;
  duplicate_of: string | null;
  created_at: number;
  updated_at: number;
  user_name?: string | null;
  user_since?: string | null;
};

export const SUB_SELECT = `SELECT s.*, u.name AS user_name, u.createdAt AS user_since,
  (SELECT r.id FROM resources r WHERE r.url_normalised = s.url_normalised AND r.status <> 'retired') AS dup_id,
  (SELECT r.title FROM resources r WHERE r.url_normalised = s.url_normalised AND r.status <> 'retired') AS dup_title
  ,(SELECT COUNT(*) FROM resource_submissions x WHERE x.user_id = s.user_id) AS sub_total,
  (SELECT COUNT(*) FROM resource_submissions x WHERE x.user_id = s.user_id AND x.status = 'accepted') AS sub_ok
  FROM resource_submissions s JOIN user u ON u.id = s.user_id`;

export type SubJoined = SubRow & {
  dup_id: string | null;
  dup_title: string | null;
  sub_total: number;
  sub_ok: number;
};

const person = (id: string | null, names: Map<string, string>) =>
  id ? { id, name: names.get(id) ?? "Someone" } : null;

export { person };

/** A row of the submissions queue. The check is what can be known without fetching the page. */
export const toSubmissionRow = (r: SubJoined, names: Map<string, string>) => ({
  id: r.id,
  title: r.title ?? hostOf(r.url),
  source: hostOf(r.url),
  type: suggestType(hostOf(r.url)),
  submitter: {
    id: r.user_id,
    name: r.user_name ?? "Former member",
    submitted: r.sub_total,
    approved: r.sub_ok,
  },
  check: r.dup_id
    ? { status: "warn" as const, label: "Possible duplicate" }
    : { status: "pass" as const, label: "Not in the library yet" },
  ageDays: ageDays(r.created_at),
  assignedTo: person(r.assigned_to, names),
});
