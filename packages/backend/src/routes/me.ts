import { zValidator } from "@hono/zod-validator";
import {
  type MeResponse,
  type OnboardingState,
  onboardingSchema,
  type SessionSummary,
} from "@matr/types";
import { Hono } from "hono";
import { z } from "zod";
import { writeAudit } from "../auth/audit";
import { type AuthedEnv, authError, can, requireSession } from "../auth/guard";
import { FRESH_AUTH_SECONDS, SESSION_COOKIE } from "../auth/index";
import { verifyPassword } from "../auth/password";
import { clientIp, describeDevice, emailRef, truncateIp } from "../auth/util";
import { notifications } from "./notifications";
import { profile } from "./profile";
import { paths } from "./paths";
import { saved } from "./saved";
import { submissions } from "./submissions";
import { support } from "./support";

export const me = new Hono<AuthedEnv>();
me.use("*", requireSession);
me.route("/me/submissions", submissions);
me.route("/me/saved", saved);
me.route("/me/notifications", notifications);
me.route("/me/support", support);
me.route("/me/profile", profile);
me.route("/me/paths", paths);

// Validation failures use the same { code, message } body as every other auth error.
const invalid = (
  result: { success: boolean },
  c: { json: (b: unknown, s: 400) => Response },
): Response | undefined =>
  result.success
    ? undefined
    : c.json(authError("invalid_request", "Check the details you entered."), 400);

type OnboardingRow = {
  goal: string | null;
  level: string | null;
  topics: string;
  completed_at: number | null;
};

const toState = (row: OnboardingRow | null): OnboardingState => ({
  goal: (row?.goal ?? null) as OnboardingState["goal"],
  level: (row?.level ?? null) as OnboardingState["level"],
  topics: row ? (JSON.parse(row.topics) as OnboardingState["topics"]) : [],
  completed: row?.completed_at != null,
  completedAt: row?.completed_at ?? null,
});

async function loadOnboarding(db: D1Database, userId: string) {
  return db
    .prepare("SELECT goal, level, topics, completed_at FROM onboarding WHERE userId = ?")
    .bind(userId)
    .first<OnboardingRow>();
}

const expiredSessionCookie = () =>
  `${SESSION_COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`;

me.get("/me", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "view"))
    return c.json(authError("forbidden", "Not allowed."), 403);
  const [onboarding, accounts, passkeys] = await Promise.all([
    loadOnboarding(c.env.DB, user.id),
    c.env.DB.prepare("SELECT providerId FROM account WHERE userId = ?")
      .bind(user.id)
      .all<{ providerId: string }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM passkey WHERE userId = ?")
      .bind(user.id)
      .first<{ n: number }>(),
  ]);
  const body: MeResponse = {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    onboarding: toState(onboarding),
    providers: accounts.results.map((a) =>
      a.providerId === "credential" ? "password" : a.providerId,
    ),
    passkeyCount: passkeys?.n ?? 0,
  };
  return c.json(body);
});

// Partial, idempotent save: send any of goal, level, topics; the same body twice gives the same
// state. completed_at is set the first time all three are present, and never moves afterwards.
me.post("/me/onboarding", zValidator("json", onboardingSchema, invalid), async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage")) {
    return c.json(authError("forbidden", "Not allowed."), 403);
  }
  const input = c.req.valid("json");
  const current = await loadOnboarding(c.env.DB, user.id);
  const goal = input.goal ?? current?.goal ?? null;
  const level = input.level ?? current?.level ?? null;
  const topics = input.topics ?? (current ? (JSON.parse(current.topics) as string[]) : []);
  const done = goal !== null && level !== null && topics.length > 0;
  await c.env.DB.prepare(
    `INSERT INTO onboarding (userId, goal, level, topics, completed_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, CASE WHEN ?5 THEN unixepoch() END, unixepoch())
     ON CONFLICT(userId) DO UPDATE SET
       goal = ?2, level = ?3, topics = ?4,
       completed_at = COALESCE(completed_at, CASE WHEN ?5 THEN unixepoch() END),
       updated_at = unixepoch()`,
  )
    .bind(user.id, goal, level, JSON.stringify(topics), done ? 1 : 0)
    .run();
  return c.json({ onboarding: toState(await loadOnboarding(c.env.DB, user.id)) });
});

type SessionRow = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

// Every query is scoped by the signed-in user's id taken from the session, never from the request
// (IDOR). Stored token hashes are never selected.
me.get("/me/sessions", async (c) => {
  const user = c.get("user");
  const current = c.get("session").id;
  const rows = await c.env.DB.prepare(
    `SELECT id, userAgent, ipAddress, createdAt, updatedAt FROM session
      WHERE userId = ? AND expiresAt > ? ORDER BY updatedAt DESC`,
  )
    .bind(user.id, new Date().toISOString())
    .all<SessionRow>();
  const sessions: SessionSummary[] = rows.results.map((r) => ({
    id: r.id,
    current: r.id === current,
    device: describeDevice(r.userAgent),
    ip: truncateIp(r.ipAddress),
    createdAt: r.createdAt,
    lastSeenAt: r.updatedAt,
  }));
  return c.json({ sessions });
});

me.post("/me/sessions/revoke-others", async (c) => {
  const user = c.get("user");
  const res = await c.env.DB.prepare("DELETE FROM session WHERE userId = ? AND id <> ?")
    .bind(user.id, c.get("session").id)
    .run();
  await writeAudit(c.env.DB, {
    actor: user.id,
    action: "session.revoked",
    ip: clientIp(c.req.raw.headers),
    ua: c.req.header("user-agent"),
    meta: { scope: "others", count: res.meta.changes ?? 0 },
  });
  return c.json({ revoked: res.meta.changes ?? 0 });
});

me.post(
  "/me/sessions/revoke",
  zValidator("json", z.object({ id: z.string().min(1).max(64) }).strict(), invalid),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("json");
    // "AND userId = ?" is the object-level check: someone else's id simply matches nothing.
    const res = await c.env.DB.prepare("DELETE FROM session WHERE id = ? AND userId = ?")
      .bind(id, user.id)
      .run();
    if (!res.meta.changes) return c.json(authError("not_found", "Session not found."), 404);
    await writeAudit(c.env.DB, {
      actor: user.id,
      action: "session.revoked",
      ip: clientIp(c.req.raw.headers),
      ua: c.req.header("user-agent"),
      meta: { scope: "one" },
    });
    // Revoking the current session also signs this browser out.
    if (id === c.get("session").id) c.header("Set-Cookie", expiredSessionCookie());
    return c.json({ revoked: 1 });
  },
);

// Account deletion: removes personal data, revokes sessions, anonymises audit rows. Needs recent
// re-authentication: a session created in the last 5 minutes, or the account password in the body.
me.delete("/me", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  const parsed = z
    .object({ password: z.string().max(128).optional() })
    .strict()
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return c.json(authError("invalid_request", "Check the details you entered."), 400);
  const fresh = Date.now() - c.get("session").createdAt.getTime() < FRESH_AUTH_SECONDS * 1000;
  if (!fresh) {
    const password = parsed.data.password;
    const account = password
      ? await db
          .prepare("SELECT password FROM account WHERE userId = ? AND providerId = 'credential'")
          .bind(user.id)
          .first<{ password: string | null }>()
      : null;
    if (!password || !account?.password || !(await verifyPassword(account.password, password))) {
      return c.json(authError("reauth_required", "Confirm it is you to delete your account."), 401);
    }
  }
  const eref = await emailRef(c.env.BETTER_AUTH_SECRET, user.email);
  await db.batch([
    db.prepare("DELETE FROM session WHERE userId = ?").bind(user.id),
    db.prepare("DELETE FROM account WHERE userId = ?").bind(user.id),
    db.prepare("DELETE FROM passkey WHERE userId = ?").bind(user.id),
    db.prepare("DELETE FROM onboarding WHERE userId = ?").bind(user.id),
    db
      .prepare("DELETE FROM verification WHERE value = ?1 OR value LIKE ?2")
      .bind(user.id, `%"email":"${user.email.toLowerCase()}"%`), // magic-link records carry the address
    db.prepare("DELETE FROM invites WHERE email = ?").bind(user.email.toLowerCase()),
    db
      .prepare(
        "UPDATE audit_log SET actor = NULL, target = NULL, ip = NULL, ua = NULL WHERE actor = ?1 OR target = ?1 OR target = ?2",
      )
      .bind(user.id, `email:${eref}`),
    db.prepare("DELETE FROM user WHERE id = ?").bind(user.id),
  ]);
  await writeAudit(db, { action: "account.deleted", meta: {} });
  c.header("Set-Cookie", expiredSessionCookie());
  return c.json({ deleted: true });
});
