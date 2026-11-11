/**
 * Every admin route in one place, so screens and the shell agree on paths. Detail pages use query
 * parameters (static export has no dynamic ids): `ADMIN_ROUTES.resourceDetail(id)`.
 */
const q = (id: string) => `?id=${encodeURIComponent(id)}`;

export const ADMIN_ROUTES = {
  home: "/",
  signIn: "/sign-in",
  twoStep: "/sign-in/two-step",
  acceptInvite: "/accept-invite",
  dashboard: "/dashboard",
  metrics: "/metrics",
  resources: "/resources",
  resourceDetail: (id: string) => `/resources/detail${q(id)}`,
  paths: "/paths",
  pathDetail: (id: string) => `/paths/detail${q(id)}`,
  review: "/review",
  submissionDetail: (id: string) => `/review/submissions/detail${q(id)}`,
  users: "/users",
  userDetail: (id: string) => `/users/detail${q(id)}`,
  support: "/support",
  team: "/team",
  roles: "/roles",
  audit: "/audit",
  settings: "/settings",
} as const;

/** Where to send an admin after sign-in: only same-site absolute paths, never a full URL. */
export function safeNext(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return ADMIN_ROUTES.dashboard;
  }
  if (value.startsWith("/sign-in") || value.startsWith("/accept-invite")) {
    return ADMIN_ROUTES.dashboard;
  }
  return value;
}

/** "/resources/" and "/resources" are the same page (the export may add a trailing slash). */
export function normalisePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}
