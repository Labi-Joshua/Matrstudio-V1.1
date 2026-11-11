import type { SearchData, SearchGroupId, SearchHit } from "../session/api";
import type { AdminMe } from "../session/types";
import { canOpenArea } from "./menu";
import { ADMIN_ROUTES } from "./routes";

export const MAX_QUERY = 100;

/** Trim, collapse spaces, cap the length. A blank query is never sent. */
export const normaliseQuery = (raw: string): string =>
  raw.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY).trim();

export const GROUPS: readonly { id: SearchGroupId; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "resources", label: "Resources" },
  { id: "paths", label: "Paths" },
  { id: "submissions", label: "Submissions" },
];

const GROUP_AREA = {
  users: "users_waitlist",
  resources: "resources",
  paths: "paths",
  submissions: "review_queues",
} as const;

export function hitHref(hit: SearchHit): string {
  switch (hit.group) {
    case "users":
      return ADMIN_ROUTES.userDetail(hit.id);
    case "resources":
      return ADMIN_ROUTES.resourceDetail(hit.id);
    case "paths":
      return ADMIN_ROUTES.pathDetail(hit.id);
    case "submissions":
      return ADMIN_ROUTES.submissionDetail(hit.id);
  }
}

/** "in_review" -> "In review". */
export function humanise(status: string): string {
  const words = status.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export type ShownGroup = { id: SearchGroupId; label: string; hits: SearchHit[] };

/**
 * The groups to draw. The API already filters by area; this repeats the check so a group the admin
 * cannot open is never shown even if a response included it. Empty groups are dropped.
 */
export function shownGroups(
  data: SearchData,
  me: Pick<AdminMe, "permissions" | "menu">,
): ShownGroup[] {
  return GROUPS.filter((g) => canOpenArea(me, GROUP_AREA[g.id]))
    .map((g) => ({ ...g, hits: data[g.id] }))
    .filter((g) => g.hits.length > 0);
}

export const flattenHits = (groups: readonly ShownGroup[]): SearchHit[] =>
  groups.flatMap((g) => g.hits);

/** Row subtitle: users show their email, the rest a readable status. */
export const hitDetail = (hit: SearchHit): string =>
  hit.group === "users" ? hit.detail : hit.detail ? humanise(hit.detail) : "";
