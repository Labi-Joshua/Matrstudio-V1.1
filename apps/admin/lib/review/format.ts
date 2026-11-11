import type { CheckStatus } from "./types";

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Today", "1 day", "4 days" (the Waiting column). */
export function waitingLabel(days: number): string {
  return days <= 0 ? "Today" : plural(days, "day");
}

/** "today", "1 day ago", "4 days ago". */
export function agoLabel(days: number): string {
  return days <= 0 ? "today" : `${plural(days, "day")} ago`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "them";
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts.slice(0, 1);
  return letters.map((p) => (p ?? "").charAt(0).toUpperCase()).join("") || "?";
}

/** Only http and https links are ever rendered as anchors. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** "figma.com/blog/spacing" from a full URL, for the compact Link row. */
export function shortUrl(url: string, max = 28): string {
  const bare = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  return bare.length > max ? `${bare.slice(0, max - 1)}…` : bare;
}

export function minutesLabel(type: string, minutes: number | null): string | null {
  if (!minutes) return null;
  return type === "article" ? `${minutes} min read` : `${minutes} min`;
}

export const checkTone = (status: CheckStatus) =>
  status === "pass" ? "success" : status === "warn" ? "warning" : "error";

/** Is the age past the review target (default 3 days)? */
export const isOverdue = (days: number, target = 3) => days > target;

/** The message the submitter sees for a change request: ticked reasons, then the note. */
export function changeMessage(presets: string[], note: string): string {
  const lines = presets.map((p) => `- ${p}`);
  const trimmed = note.trim();
  return [lines.join("\n"), trimmed].filter(Boolean).join("\n\n");
}

export const canSendChange = (presets: string[], note: string) =>
  presets.length > 0 || note.trim().length > 0;

export function hideMessage(phrase: string): string {
  return `Your public profile was hidden because it broke our community guidelines (${phrase}). Edit your bio and links, then ask us to review it again.`;
}
