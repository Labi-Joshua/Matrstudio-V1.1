/** Date and wording helpers for the People screens. `now` is passed in so they stay testable. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

const parse = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "12 Mar 2026"; an em dash for a missing or bad date. */
export function formatDate(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "—";
}

/** "2 Sep" (no year), for the waitlist tiles. */
export function formatDay(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : "—";
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function dayDiff(d: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);
}

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "Today", "Yesterday", "5 days ago", "3 weeks ago", else the date. An em dash when never. */
export function lastActive(iso: string | null | undefined, now: Date): string {
  const d = parse(iso);
  if (!d) return "—";
  const days = dayDiff(d, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return formatDate(iso);
}

/** "Today, 09:14", "Yesterday, 16:20", "2 days ago", or the date. */
export function whenLabel(iso: string | null | undefined, now: Date): string {
  const d = parse(iso);
  if (!d) return "—";
  const days = dayDiff(d, now);
  if (days <= 0) return `Today, ${hhmm(d)}`;
  if (days === 1) return `Yesterday, ${hhmm(d)}`;
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

/** Age of a request: "3 h ago", "2 days ago". */
export function ageLabel(iso: string | null | undefined, now: Date): string {
  const d = parse(iso);
  if (!d) return "—";
  const hours = Math.floor((now.getTime() - d.getTime()) / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function span(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

/** Reply-due cell: "Overdue 2 h", "6 h", "1 day"; an em dash when nothing is due. */
export function dueShort(dueAt: string | null, overdue: boolean, now: Date): string {
  const d = parse(dueAt);
  if (!d) return overdue ? "Overdue" : "—";
  const diff = d.getTime() - now.getTime();
  return diff < 0 || overdue ? `Overdue ${span(Math.abs(diff))}` : span(diff);
}

function long(ms: number): string {
  const hours = Math.max(1, Math.round(ms / 3_600_000));
  if (hours < 48) return hours === 1 ? "1 hour" : `${hours} hours`;
  return `${Math.round(hours / 24)} days`;
}

/** The SLA line on a request: "First reply due in 6 hours" / "Overdue by 2 hours". */
export function slaLine(dueAt: string | null, overdue: boolean, now: Date): string | null {
  const d = parse(dueAt);
  if (!d) return overdue ? "Overdue" : null;
  const diff = d.getTime() - now.getTime();
  return diff < 0 || overdue
    ? `Overdue by ${long(Math.abs(diff))}`
    : `First reply due in ${long(diff)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] || "them";

export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

export const percent = (part: number, whole: number): string =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
