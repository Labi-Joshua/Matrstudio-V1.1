import { validateEmail } from "../auth/validation";
import { HELP_CONTACT, HELP_EMAIL, HELP_REPORT, MESSAGE_MAX } from "../pages/company-help";

/**
 * Pure logic of the in-app Contact support and Report a problem forms (Figma Help centre).
 *
 * TODO(support-api): there is no support-ticket backend yet, so "sending" opens the learner's
 * email app with a prefilled mailto: to hello@matrstudio.com, exactly like the public /help page.
 * When the support API exists, post the same fields (plus the Turnstile token, docs/SECURITY-AUTH.md
 * section 5) instead and drop buildMailto().
 */
export { HELP_EMAIL, MESSAGE_MAX };

export const CONTACT_TOPICS: readonly string[] = HELP_CONTACT.topics;
export const REPORT_KINDS = HELP_REPORT.types;

export type ContactDraft = { topic: string; message: string; replyTo: string };
export type ContactField = "topic" | "message" | "replyTo";
export type ContactErrors = Partial<Record<ContactField, string>>;

export const HELP_MESSAGES = {
  topic: "Pick a topic.",
  message: "Tell us what you need help with.",
  messageTooLong: `Keep this under ${MESSAGE_MAX} characters.`,
  generalMissing: "Some details are missing. Check the fields marked in red.",
  kind: "Choose what kind of problem it is.",
  detail: "Tell us what happened.",
  link: "Links must start with https://. Leave it empty if you don’t have one.",
} as const;

export function validateContact(draft: ContactDraft): ContactErrors {
  const errors: ContactErrors = {};
  if (!CONTACT_TOPICS.includes(draft.topic)) errors.topic = HELP_MESSAGES.topic;
  const message = draft.message.trim();
  if (message === "") errors.message = HELP_MESSAGES.message;
  else if (message.length > MESSAGE_MAX) errors.message = HELP_MESSAGES.messageTooLong;
  // The reply-to address is optional here (the account email is the default), but must be valid if given.
  if (draft.replyTo.trim() !== "") {
    const problem = validateEmail(draft.replyTo);
    if (problem) errors.replyTo = problem;
  }
  return errors;
}

export type ReportDraft = { kind: string; detail: string; link: string };
export type ReportField = "kind" | "detail" | "link";
export type ReportErrors = Partial<Record<ReportField, string>>;

/** The optional page or link: empty, or a link that is https (typed with or without the prefix). */
export function normaliseReportLink(raw: string): string | null | undefined {
  const text = raw.trim();
  if (text === "") return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) && !/^https:\/\//i.test(text)) return undefined;
  if (/^(javascript|data|vbscript|mailto):/i.test(text) || /\s/.test(text)) return undefined;
  const withScheme = /^https:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.username || url.password || !url.hostname.includes(".")) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function validateReport(draft: ReportDraft): ReportErrors {
  const errors: ReportErrors = {};
  if (!REPORT_KINDS.some((k) => k.id === draft.kind)) errors.kind = HELP_MESSAGES.kind;
  const detail = draft.detail.trim();
  if (detail === "") errors.detail = HELP_MESSAGES.detail;
  else if (detail.length > MESSAGE_MAX) errors.detail = HELP_MESSAGES.messageTooLong;
  if (normaliseReportLink(draft.link) === undefined) errors.link = HELP_MESSAGES.link;
  return errors;
}

/** Subject lines cannot carry line breaks or control characters (header injection in some clients). */
function cleanSubject(subject: string): string {
  return (
    subject
      // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      .trim()
      .slice(0, 120)
  );
}

/** A mailto: link for hello@matrstudio.com. Empty lines are kept, empty values are dropped by callers. */
export function buildMailto(subject: string, lines: readonly string[]): string {
  const body = lines.join("\n");
  return `mailto:${HELP_EMAIL}?subject=${encodeURIComponent(cleanSubject(subject))}&body=${encodeURIComponent(body)}`;
}

export function contactMailto(draft: ContactDraft, accountEmail: string): string {
  const replyTo = draft.replyTo.trim() || accountEmail;
  return buildMailto(`Support: ${draft.topic}`, [draft.message.trim(), "", `Reply to: ${replyTo}`]);
}

export function reportMailto(draft: ReportDraft, accountEmail: string): string {
  const label = REPORT_KINDS.find((k) => k.id === draft.kind)?.label ?? draft.kind;
  const link = normaliseReportLink(draft.link);
  const lines = [draft.detail.trim(), ""];
  if (link) lines.push(`Page or link: ${link}`);
  lines.push(`Reply to: ${accountEmail}`);
  return buildMailto(`Problem report: ${label}`, lines);
}
