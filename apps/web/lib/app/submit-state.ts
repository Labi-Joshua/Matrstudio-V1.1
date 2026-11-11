import type { ApiFailure } from "../auth/api";
import { authErrorCopy } from "../auth/messages";
import type { Submission, SubmissionStatus } from "../auth/submissions-api";
import { checkLink, LINK_MESSAGES } from "./submit-url";

/**
 * Pure logic of the Submit a resource screen (Figma Library > Submit flow): validating the form,
 * turning an API failure into the designed state, and how a submission row reads. Kept free of
 * React so it is tested on its own.
 */
export const TITLE_MAX = 120;
export const NOTE_MAX = 200;

export type SubmitField = "url" | "title" | "topic" | "note";
export type SubmitErrors = Partial<Record<SubmitField, string>>;

export type SubmitDraft = { url: string; title: string; topic: string; note: string };

export const EMPTY_DRAFT: SubmitDraft = { url: "", title: "", topic: "", note: "" };

export const FIELD_ORDER: readonly SubmitField[] = ["url", "title", "topic", "note"];

export const FIELD_MESSAGES = {
  title: "Give it a title so curators know what it is.",
  titleTooLong: `Keep the title under ${TITLE_MAX} characters.`,
  topic: "Pick the topic it fits best.",
  noteTooLong: `Keep this under ${NOTE_MAX} characters.`,
  generic: "Check this and try again.",
} as const;

/**
 * Checks the form before sending. `needsLink` is false when editing a resubmission, where the
 * link cannot change. Returns only the fields with a problem.
 */
export function validateDraft(draft: SubmitDraft, needsLink = true): SubmitErrors {
  const errors: SubmitErrors = {};
  if (needsLink) {
    const link = checkLink(draft.url);
    if (!link.ok) errors.url = LINK_MESSAGES[link.problem];
  }
  const title = draft.title.trim();
  if (title === "") errors.title = FIELD_MESSAGES.title;
  else if (title.length > TITLE_MAX) errors.title = FIELD_MESSAGES.titleTooLong;
  if (draft.topic === "") errors.topic = FIELD_MESSAGES.topic;
  if (draft.note.trim().length > NOTE_MAX) errors.note = FIELD_MESSAGES.noteTooLong;
  return errors;
}

/** The first field with an error, in the order they appear on screen (for moving focus). */
export function firstErrorField(errors: SubmitErrors): SubmitField | null {
  return FIELD_ORDER.find((field) => errors[field]) ?? null;
}

/** What the screen shows after a failed send. */
export type SubmitFeedback = {
  fieldErrors: SubmitErrors;
  /** A notice above the actions (the "couldn’t send" state), or null when only fields are marked. */
  banner: {
    tone: "error" | "warning";
    title: string;
    description: string;
    /** Offer "Try again" (the failure was the network or the server, not the input). */
    retry?: boolean;
  } | null;
  /** The link was already sent by this learner (409). */
  alreadySubmitted: boolean;
  /** The Turnstile token was used or refused, so the widget must be reset. */
  resetCaptcha: boolean;
};

const isField = (key: string): key is SubmitField =>
  (FIELD_ORDER as readonly string[]).includes(key);

export function feedbackForFailure(failure: ApiFailure): SubmitFeedback {
  const base: SubmitFeedback = {
    fieldErrors: {},
    banner: null,
    alreadySubmitted: false,
    resetCaptcha: true,
  };
  switch (failure.code) {
    case "invalid_url":
      return { ...base, fieldErrors: { url: LINK_MESSAGES.invalid } };
    case "already_submitted":
      return { ...base, alreadySubmitted: true };
    case "invalid_request": {
      const fieldErrors: SubmitErrors = {};
      for (const key of Object.keys(failure.fieldErrors ?? {})) {
        // Never echo server text into a field: the message is ours, only the field is theirs.
        if (isField(key))
          fieldErrors[key] = key === "url" ? LINK_MESSAGES.invalid : FIELD_MESSAGES.generic;
      }
      if (Object.keys(fieldErrors).length > 0) return { ...base, fieldErrors };
      return { ...base, banner: couldNotSend() };
    }
    case "captcha_required":
    case "captcha_failed":
    case "captcha_unavailable": {
      const copy = authErrorCopy(failure);
      return { ...base, banner: { tone: "warning", ...copy } };
    }
    case "rate_limited":
    case "too_many_attempts": {
      const copy = authErrorCopy(failure);
      return { ...base, banner: { tone: "warning", ...copy } };
    }
    case "unauthorized":
      return {
        ...base,
        banner: {
          tone: "error",
          title: "You’ve been signed out",
          description: "Sign in again to send your resource.",
        },
      };
    case "not_editable":
      return {
        ...base,
        banner: {
          tone: "warning",
          title: "This submission can’t be changed",
          description: "A curator has already looked at it again. Refresh to see where it stands.",
        },
      };
    case "not_found":
      return {
        ...base,
        banner: {
          tone: "error",
          title: "We couldn’t find this submission",
          description: "Refresh the list and try again.",
        },
      };
    default:
      return { ...base, banner: couldNotSend() };
  }
}

/** Figma "Submit: couldn’t send (error)". */
function couldNotSend() {
  return {
    tone: "error" as const,
    title: "We couldn’t send your resource",
    description: "Check your connection and try again. Your details are still here.",
    retry: true,
  };
}

// ---------------------------------------------------------------------------------------------
// The "My submissions" list
// ---------------------------------------------------------------------------------------------

export type StatusTone = "amber" | "green" | "orange" | "red";

export const STATUS_PRESENTATION: Record<SubmissionStatus, { label: string; tone: StatusTone }> = {
  in_review: { label: "In review", tone: "amber" },
  accepted: { label: "Approved", tone: "green" },
  needs_changes: { label: "Needs a change", tone: "orange" },
  declined: { label: "Declined", tone: "red" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "today", "yesterday", "3 Oct", or "3 Oct 2025" for another year. Empty for a bad date. */
export function formatShortDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  const base = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

/**
 * The grey line under a submission title (Figma row): topic, then what happened. A curator's
 * note is plain text and is shown as written (it is truncated by CSS, never rendered as HTML).
 */
export function submissionDetail(
  submission: Pick<Submission, "status" | "curatorNote" | "createdAt" | "updatedAt">,
  topicName: string | null,
  now: Date = new Date(),
): string {
  const parts: string[] = [];
  if (topicName) parts.push(topicName);
  const note = submission.curatorNote?.trim();
  switch (submission.status) {
    case "in_review":
      parts.push(`Submitted ${formatShortDate(submission.createdAt, now)}`.trim());
      break;
    case "accepted":
      parts.push(`Approved ${formatShortDate(submission.updatedAt, now)}`.trim());
      break;
    case "needs_changes":
      parts.push(note ? `Curator note: ${note}` : "A curator asked for a change");
      break;
    case "declined":
      parts.push(note ? `Declined: ${note}` : "Declined");
      break;
  }
  return parts.join(" · ");
}

/** Newest first, whatever order the API used. */
export function sortSubmissions<T extends Pick<Submission, "createdAt">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
