import type { Context, MiddlewareHandler } from "hono";
import type { AccessEnv } from "./access";
import {
  type AdminArea,
  type AdminLevel,
  canAdmin,
  loadPermissions,
  type Permissions,
} from "./admin-perms";
import {
  ADMIN_FRESH_AUTH_SECONDS,
  type AdminAccount,
  type AdminSession,
  adminTokenFrom,
  loadAdminSession,
} from "./admin-session";
import { writeAudit } from "./audit";
import { authError } from "./guard";
import { clientIp } from "./util";

export type AdminCtx = AccessEnv & {
  Variables: AccessEnv["Variables"] & {
    admin: AdminAccount;
    adminSession: AdminSession;
    permissions: Permissions;
  };
};

/**
 * Lock 2 (after lock 1, requireAccess, which must run first on the same router). A request needs a
 * valid admin session AND the verified Access email must equal the admin account's email, on every
 * request: a stolen session cookie does not work from another Access identity. Deny by default;
 * nothing the client sends is trusted for the id, role or permissions.
 */
async function authenticate(c: Context<AdminCtx>): Promise<Response | undefined> {
  const found = await loadAdminSession(c.env, adminTokenFrom(c.req.raw.headers), "active");
  if (!found) return c.json(authError("unauthorized", "Sign in to continue."), 401);
  if (found.admin.email !== c.get("accessEmail")) {
    await writeAudit(c.env.DB, {
      actor: found.admin.id,
      action: "admin.signin.access_mismatch",
      ip: clientIp(c.req.raw.headers),
      ua: c.req.header("user-agent"),
      meta: { where: "session" },
    });
    return c.json(authError("unauthorized", "Sign in to continue."), 401);
  }
  c.set("admin", found.admin);
  c.set("adminSession", found.session);
  c.set("permissions", await loadPermissions(c.env.DB, found.admin.roleId));
  return undefined;
}

export const requireAdminSession: MiddlewareHandler<AdminCtx> = async (c, next) => {
  const denied = await authenticate(c);
  if (denied) return denied;
  await next();
};

/** requireAdminSession plus the permission check, one helper for every handler (spec section 7). */
export const requireAdmin =
  (area: AdminArea, level: AdminLevel): MiddlewareHandler<AdminCtx> =>
  async (c, next) => {
    const denied = await authenticate(c);
    if (denied) return denied;
    if (!canAdmin(c.get("permissions"), area, level)) {
      return c.json(authError("forbidden", "You don’t have access to this."), 403);
    }
    await next();
  };

/**
 * Step-up (spec section 6.2): the session must have re-authenticated (POST /api/admin/reauth, or
 * signed in) within `maxAgeSeconds`. Use after requireAdmin on sensitive routes.
 */
export const requireFreshAuth =
  (maxAgeSeconds = ADMIN_FRESH_AUTH_SECONDS): MiddlewareHandler<AdminCtx> =>
  async (c, next) => {
    const at = c.get("adminSession")?.lastReauthAt ?? null;
    if (at === null || Math.floor(Date.now() / 1000) - at > maxAgeSeconds) {
      return c.json(authError("reauth_required", "Confirm it’s you to continue."), 401);
    }
    await next();
  };
