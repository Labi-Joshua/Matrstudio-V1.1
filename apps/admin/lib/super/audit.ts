/** Labels and filter helpers for the Audit log screen. */
export const ACTION_LABEL: Record<string, string> = {
  "admin.role.assigned": "Changed role",
  "admin.role.created": "Created role",
  "admin.role.updated": "Edited role",
  "admin.role.deleted": "Deleted role",
  "admin.suspended": "Suspended admin",
  "admin.restored": "Restored admin",
  "admin.unlocked": "Unlocked admin",
  "admin.removed": "Removed admin",
  "admin.access.temporary": "Set temporary access",
  "admin.invite.created": "Invited admin",
  "admin.invite.cancelled": "Cancelled invite",
  "admin.invite.resent": "Resent invite",
  "admin.invite.accepted": "Accepted invite",
  "admin.session.revoked": "Signed out everywhere",
  "admin.signin.success": "Signed in",
  "admin.signin.failure": "Failed sign-in",
  "admin.signin.paused": "Sign-in paused",
  "admin.mfa.reset": "Reset 2-step",
  "admin.reauth.success": "Confirmed identity",
  "admin.reauth.failure": "Failed to confirm identity",
  "admin.password.set": "Changed password",
  "admin.signout": "Signed out",
  "submission.reviewed": "Reviewed submission",
  "path.published": "Published path",
  "path.unpublished": "Unpublished path",
  "resource.published": "Published resource",
  "resource.retired": "Retired resource",
};

/** Options for the Action filter (value is the machine action sent as ?action=). */
export const ACTION_FILTERS: readonly { value: string; label: string }[] = [
  "admin.role.assigned",
  "admin.role.created",
  "admin.role.updated",
  "admin.role.deleted",
  "admin.invite.created",
  "admin.invite.cancelled",
  "admin.suspended",
  "admin.restored",
  "admin.unlocked",
  "admin.removed",
  "admin.access.temporary",
  "admin.session.revoked",
  "submission.reviewed",
  "path.published",
  "resource.published",
].map((value) => ({ value, label: ACTION_LABEL[value] ?? humanizeAction(value) }));

/** "admin.role.assigned" -> "Role assigned" for actions without a hand-written label. */
export function humanizeAction(action: string): string {
  const parts = action.split(".").filter((p) => p && p !== "admin");
  const text = parts.join(" ").replace(/_/g, " ").trim();
  if (!text) return "Unknown action";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const actionLabel = (action: string): string =>
  ACTION_LABEL[action] ?? humanizeAction(action);

export const DATE_RANGES = [
  { value: "24h", label: "Last 24 hours", hours: 24 },
  { value: "7d", label: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "Last 30 days", hours: 24 * 30 },
  { value: "90d", label: "Last 90 days", hours: 24 * 90 },
  { value: "all", label: "All time", hours: 0 },
] as const;
export type DateRange = (typeof DATE_RANGES)[number]["value"];
export const DEFAULT_RANGE: DateRange = "7d";

/** ISO `from` for a range value; undefined for "all". `now` is a parameter so tests are exact. */
export function rangeFrom(range: string, now = Date.now()): string | undefined {
  const found = DATE_RANGES.find((r) => r.value === range);
  if (!found || found.hours === 0) return undefined;
  return new Date(now - found.hours * 3_600_000).toISOString();
}

/** "Password and 2-step code" style text when the API only says which factors were used. */
export function confirmedWithLabel(value: string): string {
  const v = value.trim();
  if (!v) return "";
  const known: Record<string, string> = {
    password_and_totp: "Password and 2-step code",
    totp: "2-step code",
    backup_code: "Backup code",
    password: "Password",
  };
  return known[v] ?? v;
}
