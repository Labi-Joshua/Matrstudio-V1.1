import type { AdminRange } from "@matr/types";

const DAY = 86400;
const MAX_CUSTOM_DAYS = 366;

export type Period = { start: number; end: number };
export type ResolvedRange = {
  key: AdminRange;
  current: Period;
  previous: Period;
  /** Seconds in each of the 7 buckets of the current (and previous) period. */
  bucket: number;
};

export const iso = (s: number) => new Date(s * 1000).toISOString();
export const isoOrNull = (s: number | null | undefined) => (s == null ? null : iso(s));

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: string | undefined) => {
  if (!v || !DATE.test(v)) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
};

/**
 * Turns ?range=today|7d|30d|90d|custom&from=YYYY-MM-DD&to=YYYY-MM-DD into the period and the
 * equally long period right before it. Default is 7d. Custom ranges are whole UTC days, `to`
 * included, at most 366 days (so every aggregate reads a bounded slice). Null means invalid.
 */
export function resolveRange(
  q: { range?: string; from?: string; to?: string },
  now = Math.floor(Date.now() / 1000),
): ResolvedRange | null {
  const key = (q.range ?? "7d") as AdminRange;
  let start: number;
  let end = now + 1; // whole seconds, so events in the current second still count
  switch (key) {
    case "today":
      start = now - (now % DAY);
      break;
    case "7d":
      start = now - 7 * DAY;
      break;
    case "30d":
      start = now - 30 * DAY;
      break;
    case "90d":
      start = now - 90 * DAY;
      break;
    case "custom": {
      const from = day(q.from);
      const to = day(q.to);
      if (from === null || to === null || to < from) return null;
      start = from;
      end = Math.min(to + DAY, now + DAY);
      if (end <= start || end - start > MAX_CUSTOM_DAYS * DAY) return null;
      break;
    }
    default:
      return null;
  }
  const len = end - start;
  return {
    key,
    current: { start, end },
    previous: { start: start - len, end: start },
    bucket: Math.max(1, Math.floor(len / 7)),
  };
}

/** Percentage change, rounded; null when there is nothing to compare with. */
export const deltaPct = (value: number | null, previous: number | null) =>
  value === null || previous === null || previous === 0
    ? null
    : Math.round(((value - previous) / previous) * 100);

export const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : null;

/** Fills 7 buckets from sparse { b, n } rows. */
export function sevenBuckets(rows: Array<{ b: number; n: number }>): number[] {
  const out = Array.from({ length: 7 }, () => 0);
  for (const r of rows) {
    const i = Math.min(6, Math.max(0, r.b));
    out[i] = (out[i] ?? 0) + r.n;
  }
  return out;
}

export const bucketStarts = (p: Period, bucket: number) =>
  Array.from({ length: 7 }, (_, i) => iso(p.start + i * bucket));
