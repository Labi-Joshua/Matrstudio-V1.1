import {
  AVATAR_MAX_BYTES,
  type ProfileErrorBody,
  type UsernameCheckResponse,
  updateProfileSchema,
} from "@matr/types";
import { type Context, Hono } from "hono";
import { writeAudit } from "../auth/audit";
import { type AuthedEnv, authError, can } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
import { clientIp } from "../auth/util";
import {
  checkUsername,
  ensureProfile,
  PROFILE_COLUMNS,
  type ProfileRow,
  sniffImage,
  toOwnProfile,
} from "../profile/data";

// Mounted by routes/me.ts, so requireSession (and requireAuthSecret on /api/me/*) already ran.
// The user id always comes from the session; nothing in a request names another learner.
export const profile = new Hono<AuthedEnv>();

const err = (
  code: ProfileErrorBody["code"],
  message: string,
  extra: Omit<ProfileErrorBody, "code" | "message"> = {},
) => authError(code, message, extra);

const FIELD_MESSAGES = {
  displayName: "Enter a name up to 60 characters.",
  username: "Use 3 to 30 letters, numbers or underscores.",
  bio: "Keep your bio to 200 characters.",
} as const;

async function limited(c: Context<AuthedEnv>, key: "profileUser" | "profileCheckUser") {
  const user = c.get("user");
  const h = c.req.raw.headers;
  const r = await hit(c.env.DB, `${key}:${user.id}`, LIMITS[key]);
  if (r.allowed) return null;
  await writeAudit(c.env.DB, {
    actor: user.id,
    action: "rate_limit.hit",
    ip: clientIp(h),
    ua: h.get("user-agent"),
    meta: { scope: key },
  });
  c.header("Retry-After", String(r.retryAfterSec));
  return c.json(
    err("rate_limited", "You're making a lot of changes. Try again later.", {
      retryAfterSeconds: r.retryAfterSec,
    }),
    429,
  );
}

const origin = (c: Context<AuthedEnv>) => ({
  ip: clientIp(c.req.raw.headers),
  ua: c.req.raw.headers.get("user-agent"),
});

async function loadOwn(db: D1Database, userId: string) {
  return db
    .prepare(`SELECT ${PROFILE_COLUMNS} FROM profiles WHERE user_id = ?`)
    .bind(userId)
    .first<ProfileRow>();
}

profile.get("/", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "view")) return c.json(err("unauthorized", "Not allowed."), 403);
  return c.json({ profile: toOwnProfile(await ensureProfile(c.env.DB, user)) });
});

profile.get("/username-check", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "view")) return c.json(err("unauthorized", "Not allowed."), 403);
  const checked = checkUsername(c.req.query("u"));
  if (!checked.ok) {
    const body: UsernameCheckResponse = { available: false, reason: checked.reason };
    return c.json(body);
  }
  const blocked = await limited(c, "profileCheckUser");
  if (blocked) return blocked;
  const row = await c.env.DB.prepare("SELECT user_id FROM profiles WHERE username = ?")
    .bind(checked.username)
    .first<{ user_id: string }>();
  // Your own current username counts as available: you are not taking it from anyone.
  const body: UsernameCheckResponse =
    row && row.user_id !== user.id ? { available: false, reason: "taken" } : { available: true };
  return c.json(body);
});

const VISIBILITY_COLUMNS = [
  ["stats", "show_stats"],
  ["paths", "show_paths"],
  ["submissions", "show_submissions"],
] as const;

profile.patch("/", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage")) return c.json(err("unauthorized", "Not allowed."), 403);
  const parsed = updateProfileSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    const fieldErrors: NonNullable<ProfileErrorBody["fieldErrors"]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "displayName" || key === "username" || key === "bio")
        fieldErrors[key] = FIELD_MESSAGES[key];
    }
    return c.json(err("invalid_request", "Check the details you entered.", { fieldErrors }), 400);
  }
  const input = parsed.data;
  if (input.username !== undefined) {
    const checked = checkUsername(input.username);
    if (!checked.ok && checked.reason === "reserved")
      return c.json(
        err("username_reserved", "That username isn't available.", {
          fieldErrors: { username: "That username isn't available." },
        }),
        400,
      );
  }
  const blocked = await limited(c, "profileUser");
  if (blocked) return blocked;

  const db = c.env.DB;
  const current = await ensureProfile(db, user);
  const sets: string[] = [];
  const values: Array<string | number> = [];
  const changed: string[] = [];
  const set = (column: string, value: string | number, field: string) => {
    sets.push(`${column} = ?`);
    values.push(value);
    changed.push(field);
  };
  if (input.displayName !== undefined) set("display_name", input.displayName, "displayName");
  if (input.username !== undefined && input.username !== current.username)
    set("username", input.username, "username");
  if (input.bio !== undefined) set("bio", input.bio, "bio");
  if (input.isPublic !== undefined) set("is_public", input.isPublic ? 1 : 0, "isPublic");
  for (const [key, column] of VISIBILITY_COLUMNS) {
    const v = input.visibility?.[key];
    if (v !== undefined) set(column, v ? 1 : 0, `visibility.${key}`);
  }

  if (sets.length > 0) {
    try {
      await db
        .prepare(`UPDATE profiles SET ${sets.join(", ")}, updated_at = ? WHERE user_id = ?`)
        .bind(...values, Math.floor(Date.now() / 1000), user.id)
        .run();
    } catch (e) {
      if (e instanceof Error && /UNIQUE/i.test(e.message))
        return c.json(
          err("username_taken", "That username is taken.", {
            fieldErrors: { username: "That username is taken." },
          }),
          409,
        );
      throw e;
    }
    if (input.displayName !== undefined && input.displayName !== user.name)
      // The menu and emails use the account name: keep it in step with the profile name.
      await db
        .prepare("UPDATE user SET name = ?, updatedAt = ? WHERE id = ?")
        .bind(input.displayName, new Date().toISOString(), user.id)
        .run();
    await writeAudit(db, {
      actor: user.id,
      action: "profile.updated",
      meta: { fields: changed.join(",") },
      ...origin(c),
    });
    if (input.isPublic !== undefined && input.isPublic !== (current.is_public === 1))
      await writeAudit(db, {
        actor: user.id,
        action: "profile.visibility",
        meta: { public: input.isPublic },
        ...origin(c),
      });
  }
  return c.json({ profile: toOwnProfile((await loadOwn(db, user.id)) as ProfileRow) });
});

// The body is the image itself (Content-Type image/*), already resized by the browser.
profile.put("/avatar", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage")) return c.json(err("unauthorized", "Not allowed."), 403);
  const tooBig = () =>
    c.json(
      err("avatar_too_large", "That photo is too big.", {
        fieldErrors: { avatar: "That photo is too big." },
      }),
      413,
    );
  const declared = Number(c.req.header("content-length"));
  if (Number.isFinite(declared) && declared > AVATAR_MAX_BYTES) return tooBig();
  const blocked = await limited(c, "profileUser");
  if (blocked) return blocked;

  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength > AVATAR_MAX_BYTES) return tooBig();
  const type = sniffImage(bytes);
  if (!type)
    return c.json(
      err("avatar_invalid", "Use a PNG, JPEG or WebP image.", {
        fieldErrors: { avatar: "Use a PNG, JPEG or WebP image." },
      }),
      400,
    );
  const db = c.env.DB;
  await ensureProfile(db, user);
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      "UPDATE profiles SET avatar = ?, avatar_type = ?, avatar_updated_at = ?, updated_at = ? WHERE user_id = ?",
    )
    .bind(bytes, type, now, now, user.id)
    .run();
  await writeAudit(db, { actor: user.id, action: "profile.avatar.set", ...origin(c) });
  return c.json({ profile: toOwnProfile((await loadOwn(db, user.id)) as ProfileRow) });
});

profile.delete("/avatar", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage")) return c.json(err("unauthorized", "Not allowed."), 403);
  const blocked = await limited(c, "profileUser");
  if (blocked) return blocked;
  const db = c.env.DB;
  await ensureProfile(db, user);
  const res = await db
    .prepare(
      "UPDATE profiles SET avatar = NULL, avatar_type = NULL, avatar_updated_at = NULL, updated_at = ? WHERE user_id = ? AND avatar_type IS NOT NULL",
    )
    .bind(Math.floor(Date.now() / 1000), user.id)
    .run();
  if (res.meta.changes > 0)
    await writeAudit(db, { actor: user.id, action: "profile.avatar.removed", ...origin(c) });
  return c.json({ profile: toOwnProfile((await loadOwn(db, user.id)) as ProfileRow) });
});
