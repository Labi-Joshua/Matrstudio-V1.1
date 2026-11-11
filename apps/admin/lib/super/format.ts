const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** A time from the API (ISO string, unix seconds or ms) as ms since epoch; null when unusable. */
export function toMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e11 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** "10:42" in the viewer's time zone. */
export const clock = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "5 Nov 2026" (adds the year only when it is not the current one unless `year` is true). */
export function dayMonth(ms: number, now = Date.now(), year = false): string {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year || !sameYear ? ` ${d.getFullYear()}` : ""}`;
}

/** "Today, 10:42", "Yesterday, 16:03", "2 Nov, 14:08". */
export function whenLabel(ms: number | null, now = Date.now()): string {
  if (ms === null) return "—";
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000);
  if (days === 0) return `Today, ${clock(ms)}`;
  if (days === 1) return `Yesterday, ${clock(ms)}`;
  return `${dayMonth(ms, now)}, ${clock(ms)}`;
}

/** "Today", "Yesterday", "3 days ago" / "2h ago" / "1h ago" style label for last activity. */
export function agoLabel(ms: number | null, now = Date.now()): string {
  if (ms === null) return "Never";
  const diff = Math.max(0, now - ms);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && startOfDay(ms) === startOfDay(now)) return `${hours}h ago`;
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000);
  if (days === 0) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} weeks ago`;
  return dayMonth(ms, now);
}

/** "Expires in 3 days", "Expires in 1 day", "Expires in 5 hours", "Expired". */
export function expiresLabel(ms: number | null, now = Date.now()): string {
  if (ms === null) return "No expiry";
  const diff = ms - now;
  if (diff <= 0) return "Expired";
  const hours = Math.ceil(diff / 3_600_000);
  if (hours < 24) return `Expires in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(diff / 86_400_000);
  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
}

export function initials(name: string, fallback = "?"): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/** First name for sentences like "Change Seyi's role". */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Possessive: "Seyi's", "Moses'" is avoided on purpose; the design always uses 's. */
export const possessive = (name: string) => `${name}’s`;

/** `<input type="date">` value (yyyy-mm-dd) in local time. */
export function dateInputValue(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** End of the picked local day as an ISO string (access runs through that day). */
export function endOfDayIso(dateValue: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
