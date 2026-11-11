import {
  AREAS,
  type Area,
  type Level,
  type Permissions,
  type RoleDiffLine,
  SUPER_ADMIN_ID,
} from "./types";

/**
 * The permission matrix (Figma SA4.2 and SA4.3). Columns, read from the frames: Area, None, View,
 * Edit, Manage. The backend stores three levels (none, view, manage), so the Edit column is shown
 * for fidelity but is never stored: it is disabled, except that on the "Settings and Home curation"
 * row a role that holds Resources: Manage shows a caption that Home curation comes with it (the
 * brief: Home curation endpoints are guarded by resources:manage, the rest of Settings by
 * settings:manage).
 */
export const LEVEL_COLUMNS = ["none", "view", "edit", "manage"] as const;
export type LevelColumn = (typeof LEVEL_COLUMNS)[number];
export const LEVEL_LABEL: Record<LevelColumn, string> = {
  none: "None",
  view: "View",
  edit: "Edit",
  manage: "Manage",
};

export type MatrixRowKey =
  | "dashboard_metrics"
  | "resources_paths"
  | "review"
  | "users"
  | "support"
  | "settings"
  | "team"
  | "roles"
  | "audit";

export type MatrixRow = {
  key: MatrixRowKey;
  label: string;
  areas: readonly Area[];
  /** Small grey line under the label. */
  note?: string;
  /** Highest level a custom role may hold on this row (backend ceilings in admin-perms.ts). */
  max: Level;
};

export const MATRIX_ROWS: readonly MatrixRow[] = [
  {
    key: "dashboard_metrics",
    label: "Dashboard and metrics",
    areas: ["dashboard", "metrics"],
    max: "manage",
  },
  {
    key: "resources_paths",
    label: "Resources and paths",
    areas: ["resources", "paths"],
    max: "manage",
  },
  { key: "review", label: "Review queues", areas: ["review_queues"], max: "manage" },
  { key: "users", label: "Users and waitlist", areas: ["users_waitlist"], max: "manage" },
  { key: "support", label: "Support inbox", areas: ["support_inbox"], max: "manage" },
  { key: "settings", label: "Settings and Home curation", areas: ["settings"], max: "manage" },
  {
    key: "team",
    label: "Admin team",
    areas: ["admin_team"],
    note: "Edit and Manage: Super admin only",
    max: "view",
  },
  {
    key: "roles",
    label: "Roles and permissions",
    areas: ["roles"],
    note: "Edit and Manage: Super admin only",
    max: "view",
  },
  { key: "audit", label: "Audit log", areas: ["audit_log"], max: "view", note: "View only" },
];

const RANK: Record<Level, number> = { none: 0, view: 1, manage: 2 };

export const emptyPermissions = (): Permissions =>
  Object.fromEntries(AREAS.map((a) => [a, "none"])) as Permissions;

/** The level a row shows: the shared level of its areas, or "mixed" when they differ. */
export function rowLevel(perms: Permissions, row: MatrixRow): Level | "mixed" {
  const first = perms[row.areas[0] as Area];
  return row.areas.every((a) => perms[a] === first) ? first : "mixed";
}

/** Sets every area of a row to `level`, clamped to the row ceiling. */
export function setRowLevel(perms: Permissions, row: MatrixRow, level: Level): Permissions {
  const clamped = RANK[level] > RANK[row.max] ? row.max : level;
  const next = { ...perms };
  for (const a of row.areas) next[a] = clamped;
  return next;
}

/** Which radio columns a custom role can pick on a row. Edit is never selectable. */
export function columnEnabled(row: MatrixRow, column: LevelColumn): boolean {
  if (column === "edit") return false;
  if (column === "manage") return row.max === "manage";
  return true;
}

/** Caption under the Settings row: Home curation rides on Resources: Manage. */
export function rowCaption(perms: Permissions, row: MatrixRow): string | undefined {
  if (row.key === "settings" && perms.settings === "none" && perms.resources === "manage") {
    return "Home curation comes with Resources: Manage";
  }
  if (rowLevel(perms, row) === "mixed") {
    return `Mixed: ${row.areas.map((a) => `${AREA_LABEL[a]} ${LEVEL_LABEL[perms[a]]}`).join(", ")}`;
  }
  return row.note;
}

export const AREA_LABEL: Record<Area, string> = {
  dashboard: "Dashboard",
  metrics: "Metrics",
  resources: "Resources",
  paths: "Paths",
  review_queues: "Review queues",
  users_waitlist: "Users and waitlist",
  support_inbox: "Support inbox",
  admin_team: "Admin team",
  roles: "Roles and permissions",
  audit_log: "Audit log",
  settings: "Settings",
};

/** Lines for the "what changes" list: one per matrix row whose level differs. */
export function diffPermissions(before: Permissions, after: Permissions): RoleDiffLine[] {
  const lines: RoleDiffLine[] = [];
  for (const row of MATRIX_ROWS) {
    const a = rowLevel(before, row);
    const b = rowLevel(after, row);
    const same = row.areas.every((area) => before[area] === after[area]);
    if (same) continue;
    lines.push({ label: row.label, before: levelText(a), after: levelText(b) });
  }
  return lines;
}

const levelText = (level: Level | "mixed") => (level === "mixed" ? "Mixed" : LEVEL_LABEL[level]);

export const samePermissions = (a: Permissions, b: Permissions) =>
  AREAS.every((area) => a[area] === b[area]);

/** The side menu in the order of the sidebar (Figma Nav 1), for the "Menu preview" panel. */
const MENU_ORDER: readonly Area[] = [
  "dashboard",
  "metrics",
  "resources",
  "paths",
  "review_queues",
  "users_waitlist",
  "support_inbox",
  "admin_team",
  "roles",
  "audit_log",
  "settings",
];

export type MenuItem = { area: Area; label: string; note?: string };

export function menuPreview(perms: Permissions): MenuItem[] {
  const items: MenuItem[] = [];
  for (const area of MENU_ORDER) {
    if (area === "settings") {
      if (perms.settings !== "none") items.push({ area, label: "Settings" });
      else if (perms.resources === "manage") {
        items.push({ area, label: "Settings", note: "Home curation only" });
      }
      continue;
    }
    if (perms[area] !== "none") items.push({ area, label: AREA_LABEL[area] });
  }
  return items;
}

/** One-line access summary for a role row, from its permissions. */
export function accessSummary(perms: Permissions): string {
  const groups: string[] = [];
  for (const row of MATRIX_ROWS) {
    const level = rowLevel(perms, row);
    if (level === "none") continue;
    const name = row.label.toLowerCase().replace("settings and home curation", "settings");
    groups.push(level === "view" ? `${name} (view)` : name);
  }
  if (groups.length === 0) return "No access yet";
  const text = groups.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const isSuperAdminRole = (roleId: string) => roleId === SUPER_ADMIN_ID;

export const CUSTOM_ROLE_LIMIT = 20;

/** Role names the form accepts: 1 to 60 characters once trimmed (backend slices at 60). */
export function validateRoleName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "Give the role a name.";
  if (trimmed.length > 60) return "Keep the name under 60 characters.";
  return undefined;
}
