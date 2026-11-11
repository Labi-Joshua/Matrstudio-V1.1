import { formatDay } from "./format";
import type { Batch, TicketStatus, UserStatus, WaitlistEntry, WaitlistStatus } from "./types";

export type Tone = "success" | "warning" | "error" | "neutral" | "info";

export const USER_STATUS: Record<UserStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  unconfirmed: { label: "Unconfirmed", tone: "warning" },
  suspended: { label: "Suspended", tone: "error" },
};

export const WAITLIST_STATUS: Record<WaitlistStatus, { label: string; tone: Tone }> = {
  waiting: { label: "Waiting", tone: "neutral" },
  invited: { label: "Invited", tone: "warning" },
  created: { label: "Account created", tone: "success" },
  confirmed: { label: "Confirmed", tone: "success" },
};

/** What a ticket's status chip says. "New" is an open ticket nobody has replied to. */
export function ticketStatus(
  status: TicketStatus,
  flags: { isNew: boolean; logged: boolean },
): { label: string; tone: Tone } {
  switch (status) {
    case "resolved":
      return { label: "Resolved", tone: "success" };
    case "fixed":
      return { label: "Fixed", tone: "success" };
    case "cant_reproduce":
      return { label: "Can’t reproduce", tone: "neutral" };
    case "waiting_on_user":
    case "replied":
      return { label: "Waiting on user", tone: "neutral" };
    default:
      if (flags.logged) return { label: "Logged for the team", tone: "info" };
      return flags.isNew ? { label: "New", tone: "warning" } : { label: "Open", tone: "neutral" };
  }
}

export const isClosed = (s: TicketStatus): boolean =>
  s === "resolved" || s === "fixed" || s === "cant_reproduce";

export const KIND_LABEL = { support: "Contact support", report: "Report a problem" } as const;

export const SUSPEND_REASONS = [
  {
    value: "spam",
    label: "Spam or abuse",
    message:
      "Your account was suspended because it was used for spam or abuse. Reply to this email if you think this is a mistake.",
  },
  {
    value: "guidelines",
    label: "Broke the community guidelines",
    message:
      "Your account was suspended because it broke our community guidelines. Reply to this email if you think this is a mistake.",
  },
  {
    value: "security",
    label: "Security concern",
    message:
      "We suspended your account while we look into a security concern. Reply to this email and we will help you get back in.",
  },
  {
    value: "other",
    label: "Something else",
    message: "Your account was suspended. Reply to this email if you think this is a mistake.",
  },
] as const;

export const SEVERITIES = [
  { value: "low", label: "Low · a nuisance" },
  { value: "medium", label: "Medium · something is off" },
  { value: "high", label: "High · blocks a lesson" },
] as const;

export const ISSUE_AREAS = [
  "Paths",
  "Library",
  "Account and sign-in",
  "Submissions",
  "Something else",
];

/** The typed-confirmation check for deleting an account: exact email, ignoring case and spaces. */
export const deleteConfirmed = (typed: string, email: string): boolean =>
  email.length > 0 && typed.trim().toLowerCase() === email.trim().toLowerCase();

export const INVITE_MAX = 500;
export const INVITE_DEFAULT = 100;

/** The batch size to offer: the default, but never more than the people waiting or the cap. */
export const clampInvite = (value: number, waiting: number): number =>
  Math.max(0, Math.min(Math.floor(Number.isFinite(value) ? value : 0), waiting, INVITE_MAX));

/**
 * "The oldest 100 on the waitlist, who joined between 2 and 9 Sep." The list is oldest first, so
 * the Nth loaded entry gives the end of the range; without enough loaded rows only the start is known.
 */
export function inviteRangeLine(
  count: number,
  entries: WaitlistEntry[],
  oldestWaitingAt: string | null,
): string {
  const lead = `The oldest ${count.toLocaleString("en-GB")} on the waitlist`;
  const waiting = entries.filter((e) => e.status === "waiting");
  const from = waiting[0]?.joinedAt ?? oldestWaitingAt;
  const to = waiting[count - 1]?.joinedAt;
  if (!from) return `${lead}.`;
  if (!to || to === from || formatDay(to) === formatDay(from))
    return `${lead}, who joined from ${formatDay(from)}.`;
  return `${lead}, who joined between ${formatDay(from)} and ${formatDay(to)}.`;
}

/** Batch line: "Batch from 25 Oct · 100 invited → 64 created an account → 58 confirmed". */
export function batchLine(b: Batch): string {
  return `Batch from ${formatDay(b.sentAt)} · ${b.invited} invited → ${b.created} created an account → ${b.confirmed} confirmed`;
}

/** The newest batch that still has people to remind (one reminder per batch). */
export function remindableBatch(batches: Batch[]): Batch | undefined {
  return [...batches]
    .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt))
    .find((b) => b.notJoined > 0 && !b.reminderSentAt);
}

/** CSV with quotes escaped, and a leading quote on cells a spreadsheet might run as a formula. */
export function toCsv(header: string[], body: string[][]): string {
  const cell = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [header, ...body].map((row) => row.map(cell).join(",")).join("\r\n");
}

/** Next ticket status labels offered in the status select (closing ones go through modals). */
export const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "waiting_on_user", label: "Waiting on user" },
  { value: "resolved", label: "Resolved" },
] as const;

export const statusSelectValue = (s: TicketStatus): string =>
  s === "replied" ? "waiting_on_user" : s;
