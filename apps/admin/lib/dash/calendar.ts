/** Month grid maths for the custom range calendar. Weeks start on Monday. */
import { toIsoDay } from "./range";

export type Month = { year: number; month: number }; // month 0-11

const NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const monthTitle = (m: Month) => `${NAMES[m.month]} ${m.year}`;

export function addMonths(m: Month, delta: number): Month {
  const index = m.year * 12 + m.month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

export const monthOf = (day: string): Month => ({
  year: Number(day.slice(0, 4)),
  month: Number(day.slice(5, 7)) - 1,
});

/** Rows of 7 cells; a cell is a day string or null for padding. */
export function monthGrid(m: Month): (string | null)[][] {
  const first = new Date(m.year, m.month, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(m.year, m.month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= count; d++) cells.push(toIsoDay(new Date(m.year, m.month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** Day string shifted by `delta` days. */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return toIsoDay(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta));
}
