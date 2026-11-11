import { REMINDER_DAYS, type ReminderDay } from "../auth/prefs-api";

export const DAY_LABELS: Record<ReminderDay, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

/** Adds or removes a day; the result is always in week order with no duplicates. */
export function toggleDay(days: readonly ReminderDay[], day: ReminderDay): ReminderDay[] {
  const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
  return REMINDER_DAYS.filter((d) => next.includes(d));
}

/** "19:00" -> "7:00 PM". Anything that is not HH:MM is returned as is. */
export function formatTime(time: string): string {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) return time;
  const hour = Number(m[1]);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m[2]} ${hour < 12 ? "AM" : "PM"}`;
}

/** Every hour of the day, in order. */
export const TIME_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 24 },
  (_, h) => {
    const value = `${String(h).padStart(2, "0")}:00`;
    return { value, label: formatTime(value) };
  },
);

/** The select's options, plus the stored time when it is not on the hour (so it still shows). */
export function timeOptions(current: string) {
  return TIME_OPTIONS.some((o) => o.value === current)
    ? TIME_OPTIONS
    : [{ value: current, label: formatTime(current) }, ...TIME_OPTIONS];
}

/** Steps the weekly goal inside its bounds. */
export function stepGoal(goal: number, delta: 1 | -1, min: number, max: number): number {
  return Math.min(max, Math.max(min, goal + delta));
}
