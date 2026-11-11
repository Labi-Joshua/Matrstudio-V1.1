/** Date range shared by the dashboard and the metrics tabs. Dates are local calendar days, "YYYY-MM-DD". */
export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";
export type DashRange = { key: RangeKey; from?: string; to?: string };

export const DEFAULT_RANGE: DashRange = { key: "7d" };

export const RANGE_OPTIONS: { key: Exclude<RangeKey, "custom">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];

/** Longest custom range the API accepts. */
export const MAX_CUSTOM_DAYS = 366;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function toIsoDay(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Days from `from` to `to`, both included. */
export function inclusiveDays(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/** null when the custom range is usable, otherwise the sentence to show. */
export function validateCustomRange(from: string, to: string, today: string): string | null {
  if (!isIsoDay(from) || !isIsoDay(to)) return "Pick a start and an end date.";
  if (to < from) return "The end date must be on or after the start date.";
  if (to > today) return "Dates in the future have no numbers yet.";
  if (inclusiveDays(from, to) > MAX_CUSTOM_DAYS) return "Pick a range of a year or less.";
  return null;
}

/** The range as the API's query string. */
export function rangeQuery(range: DashRange): string {
  if (range.key === "custom" && range.from && range.to) {
    return `range=custom&from=${range.from}&to=${range.to}`;
  }
  return `range=${range.key === "custom" ? "7d" : range.key}`;
}

/** Reads ?range=&from=&to= (what the page keeps in the address bar). Unknown values mean the default. */
export function parseRangeSearch(search: string): DashRange {
  const params = new URLSearchParams(search);
  const key = params.get("range");
  if (key === "today" || key === "7d" || key === "30d" || key === "90d") return { key };
  const from = params.get("from");
  const to = params.get("to");
  if (key === "custom" && isIsoDay(from) && isIsoDay(to) && from <= to) {
    return { key: "custom", from, to };
  }
  return DEFAULT_RANGE;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Oct" for a day string. */
export function shortDay(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]}`;
}

/** Text of the range button: "Last 7 days", or "12 Oct - 18 Oct" for a custom range. */
export function rangeLabel(range: DashRange): string {
  if (range.key === "custom" && range.from && range.to) {
    return range.from === range.to
      ? shortDay(range.from)
      : `${shortDay(range.from)} \u2013 ${shortDay(range.to)}`;
  }
  return RANGE_OPTIONS.find((o) => o.key === range.key)?.label ?? "Last 7 days";
}

/** "previous 7 days" and friends, for "vs previous 7 days" and "Compared with the previous 7 days." */
export function previousLabel(range: DashRange): string {
  switch (range.key) {
    case "today":
      return "previous day";
    case "7d":
      return "previous 7 days";
    case "30d":
      return "previous 30 days";
    case "90d":
      return "previous 90 days";
    default: {
      if (!range.from || !range.to) return "previous period";
      const days = inclusiveDays(range.from, range.to);
      return days === 1 ? "previous day" : `previous ${days} days`;
    }
  }
}
