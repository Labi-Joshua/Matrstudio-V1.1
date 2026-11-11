import type { ApiFailure } from "../auth/api";
import { formatWait } from "../auth/messages";
import type { NewTicket, Ticket, TicketStatus } from "../auth/support-api";
import { ROUTES } from "../routes";
import {
  type ContactDraft,
  normaliseReportLink,
  REPORT_KINDS,
  type ReportContext,
  type ReportDraft,
} from "./help-form";
import { relativeTime } from "./notifications";

/**
 * Pure logic of "Your requests" and the request page (Figma Help centre 485:45143, 485:45291,
 * 485:45370, 485:45618): status words and colours, the one-line summaries, the request bodies the
 * forms send, and the words for each way a send can fail.
 */

export type StatusTone = "info" | "warning" | "success" | "neutral";

/** Replied and open are the ones still in play; the rest are closed (the API refuses follow-ups). */
export const CLOSED_STATUSES: readonly TicketStatus[] = ["resolved", "fixed", "cant_reproduce"];

export const isClosed = (status: TicketStatus): boolean => CLOSED_STATUSES.includes(status);

export const STATUS_LOOK: Record<TicketStatus, { label: string; tone: StatusTone }> = {
  open: { label: "Open", tone: "warning" },
  replied: { label: "Replied", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
  fixed: { label: "Fixed", tone: "success" },
  cant_reproduce: { label: "Can’t reproduce", tone: "neutral" },
};

export const KIND_LABEL = { support: "Contact support", report: "Report a problem" } as const;

const ACTIVITY: Record<TicketStatus, string> = {
  open: "Sent",
  replied: "Support replied",
  resolved: "Resolved",
  fixed: "Fixed",
  cant_reproduce: "Couldn’t reproduce",
};

/** "Contact support · Account and sign-in · Support replied 2h ago". */
export function ticketMeta(ticket: Ticket, now: Date): string {
  const when = relativeTime(ticket.updatedAt, now).replace(/^(Just now|Yesterday)/, (word) =>
    word.toLowerCase(),
  );
  return [
    KIND_LABEL[ticket.kind],
    ticket.category,
    `${ACTIVITY[ticket.status]}${when ? ` ${when}` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "3 requests · 2 open"; open counts the ones not yet closed. */
export function requestsSummary(tickets: readonly Ticket[]): string {
  const open = tickets.filter((t) => !isClosed(t.status)).length;
  const total = `${tickets.length} request${tickets.length === 1 ? "" : "s"}`;
  return open > 0 ? `${total} · ${open} open` : total;
}

/** Newest activity first; the API already sorts by creation, a reply moves a request up. */
export function sortTickets(tickets: readonly Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export const requestHref = (id: string): string =>
  `${ROUTES.app.help}/request?id=${encodeURIComponent(id)}`;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** The ?id= of the request page; null for anything that cannot be a ticket id. */
export function parseRequestId(search: string): string | null {
  const id = new URLSearchParams(search).get("id") ?? "";
  return ID_PATTERN.test(id) ? id : null;
}

/** "23 Oct, 10:12", or "Today, 09:40" for the same calendar day as `now`. */
export function messageStamp(iso: string, now: Date): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay
    ? `Today, ${time}`
    : `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${time}`;
}

/** "23 Oct" for the request header ("Sent 23 Oct"). */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const SUBJECT_MAX = 120;

/** The subject the forms do not ask for: the first line of what the learner wrote, clipped. */
export function subjectFrom(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  const clean = line.trim().replace(/\s+/g, " ");
  return clean.length > SUBJECT_MAX ? `${clean.slice(0, SUBJECT_MAX - 1).trimEnd()}…` : clean;
}

export function contactTicket(draft: ContactDraft): NewTicket {
  const message = draft.message.trim();
  return { kind: "support", category: draft.topic, subject: subjectFrom(message), message };
}

/** The report's category is the kind's label; the context chip and the link travel as `context`. */
export function reportTicket(draft: ReportDraft, context: ReportContext | null): NewTicket {
  const message = draft.detail.trim();
  const link = normaliseReportLink(draft.link) || context?.link || "";
  const fields = {
    ...(context?.title ? { resource: context.title } : {}),
    ...(context?.where ? { where: context.where } : {}),
    ...(link ? { link } : {}),
  };
  return {
    kind: "report",
    category: REPORT_KINDS.find((k) => k.id === draft.kind)?.label ?? draft.kind,
    subject: subjectFrom(message),
    message,
    ...(Object.keys(fields).length > 0 ? { context: fields } : {}),
  };
}

export type SendNoun = "message" | "report" | "reply";

export type SendFailureCopy = {
  title: string;
  description: string;
  /** Another try can work as it is (not for a closed or missing request). */
  retry: boolean;
  /** The Turnstile check should be shown or redone. */
  captcha: boolean;
};

/**
 * What to tell the learner when a send fails. Written for the UI, never the server's message.
 * `captcha_required` / `captcha_failed` ask for the check again, `rate_limited` says how long to
 * wait, `network_error` says nothing was lost.
 */
export function sendFailureCopy(failure: ApiFailure, noun: SendNoun): SendFailureCopy {
  const kept = noun === "reply" ? "We kept your reply." : "We kept what you wrote.";
  switch (failure.code) {
    case "captcha_required":
      return {
        title: "One quick check",
        description: "Confirm you’re not a robot, then send it again.",
        retry: true,
        captcha: true,
      };
    case "captcha_failed":
      return {
        title: "We couldn’t verify you",
        description: "Try the check again, then send it. We kept what you wrote.",
        retry: true,
        captcha: true,
      };
    case "captcha_unavailable":
      return {
        title: "Verification is unavailable",
        description: `We can’t run the security check right now. Try again in a few minutes. ${kept}`,
        retry: true,
        captcha: false,
      };
    case "rate_limited": {
      const wait = failure.retryAfterSeconds ? formatWait(failure.retryAfterSeconds) : null;
      return {
        title: `Your ${noun} didn’t send`,
        description: `You’ve sent a lot of requests. ${
          wait ? `Wait ${wait} and try again.` : "Wait a little while and try again."
        } ${kept}`,
        retry: true,
        captcha: false,
      };
    }
    case "network_error":
      return {
        title: `Your ${noun} didn’t send`,
        description: `We couldn’t reach Matr Studio. Check your connection and try again. ${kept}`,
        retry: true,
        captcha: false,
      };
    case "ticket_closed":
      return {
        title: "This request is closed",
        description: "It can’t take more replies. Start a new request if you still need help.",
        retry: false,
        captcha: false,
      };
    case "not_found":
      return {
        title: "We can’t find that request",
        description: "It may have been removed. Go back to the Help centre.",
        retry: false,
        captcha: false,
      };
    case "invalid_request":
      return {
        title: `Your ${noun} didn’t send`,
        description: `Something in it wasn’t accepted. Check the fields and try again. ${kept}`,
        retry: true,
        captcha: false,
      };
    default:
      return {
        title: `Your ${noun} didn’t send`,
        description: `Something went wrong on our side. Try again in a moment. ${kept}`,
        retry: true,
        captcha: false,
      };
  }
}
