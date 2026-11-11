/** Small date helpers for notifications and the sign-in pause message. */

/** "10m ago", "1h ago", "Yesterday", "3 days ago", then a short date. */
export function relativeTime(iso: string, now = Date.now()): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const minutes = Math.max(0, Math.round((now - at) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Today / Earlier split used by the notifications panel (local calendar day). */
export function isToday(iso: string, now = Date.now()): boolean {
  const at = new Date(Date.parse(iso));
  const today = new Date(now);
  return (
    Number.isFinite(at.getTime()) &&
    at.getFullYear() === today.getFullYear() &&
    at.getMonth() === today.getMonth() &&
    at.getDate() === today.getDate()
  );
}

/** "14:35 (WAT)" for a moment `seconds` from now, in the admin's own time zone. */
export function retryClock(seconds: number, now = Date.now()): string {
  const at = new Date(now + seconds * 1000);
  const time = at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const zone = new Intl.DateTimeFormat("en-NG", { timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return zone ? `${time} (${zone})` : time;
}

/** "15 minutes", "1 minute", "45 seconds". */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/** "4 Nov, 10:12" from unix seconds. */
export function shortDateTime(unixSeconds: number): string {
  const at = new Date(unixSeconds * 1000);
  const date = at.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** "in 2 days", "in 5 hours", "in under an hour". */
export function expiresIn(unixSeconds: number, now = Date.now()): string {
  const hours = (unixSeconds * 1000 - now) / 3600000;
  if (hours < 1) return "in under an hour";
  if (hours < 48) return `in ${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}`;
  return `in ${Math.round(hours / 24)} days`;
}
