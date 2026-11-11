import type { PublicProfile, PublicProfileSubmission } from "@matr/types";
import { Hono } from "hono";
import { getAuth } from "../auth";
import { writeAudit } from "../auth/audit";
import { authError } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
import { clientIp } from "../auth/util";
import type { AppEnv } from "../env";
import { avatarUrl, checkUsername, type ProfileRow, toBytes } from "../profile/data";

// Unauthenticated. Mounted in index.ts before the session guard of routes/me.ts.
export const publicProfiles = new Hono<AppEnv>();

// One body for "private", "unknown" and "not a valid username", so nobody can probe for accounts.
const notFound = () => authError("not_found", "This profile isn't available.");

const iso = (sec: number) => new Date(sec * 1000).toISOString();

type Joined = ProfileRow & {
  joined_at: string;
  level: string | null;
  topics: string | null;
};

publicProfiles.get("/profiles/:username", async (c) => {
  c.header("Cache-Control", "no-store");
  const checked = checkUsername(c.req.param("username"));
  const h = c.req.raw.headers;
  const ip = clientIp(h);
  const limit = await hit(c.env.DB, `profile:ip:${ip}`, LIMITS.profilePublicIp);
  if (!limit.allowed) {
    await writeAudit(c.env.DB, {
      action: "rate_limit.hit",
      ip,
      ua: h.get("user-agent"),
      meta: { scope: "profile_public_ip" },
    });
    c.header("Retry-After", String(limit.retryAfterSec));
    return c.json(
      authError("rate_limited", "Too many requests. Try again later.", {
        retryAfterSeconds: limit.retryAfterSec,
      }),
      429,
    );
  }
  if (!checked.ok) return c.json(notFound(), 404);

  const db = c.env.DB;
  // is_public = 1 is part of the query: a private profile never leaves the database.
  const row = await db
    .prepare(
      `SELECT p.user_id, p.username, p.display_name, p.bio, p.avatar_type, p.avatar_updated_at,
              p.is_public, p.show_stats, p.show_paths, p.show_submissions, p.created_at, p.updated_at,
              u.createdAt AS joined_at, o.level AS level, o.topics AS topics
         FROM profiles p
         JOIN user u ON u.id = p.user_id
         LEFT JOIN onboarding o ON o.userId = p.user_id
        WHERE p.username = ? AND p.is_public = 1`,
    )
    .bind(checked.username)
    .first<Joined>();
  if (!row) return c.json(notFound(), 404);

  let submissions: PublicProfileSubmission[] | null = null;
  if (row.show_submissions === 1) {
    const rows = await db
      .prepare(
        `SELECT title, url, topic, reviewed_at FROM resource_submissions
          WHERE user_id = ? AND status = 'accepted' ORDER BY reviewed_at DESC, created_at DESC LIMIT 20`,
      )
      .bind(row.user_id)
      .all<{
        title: string | null;
        url: string;
        topic: string | null;
        reviewed_at: number | null;
      }>();
    submissions = rows.results.map((s) => ({
      title: s.title ?? hostOf(s.url),
      url: s.url,
      topic: s.topic,
      approvedAt: s.reviewed_at === null ? null : iso(s.reviewed_at),
    }));
  }

  let topics: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.topics ?? "[]");
    if (Array.isArray(parsed)) topics = parsed.filter((t): t is string => typeof t === "string");
  } catch {}

  const profile: PublicProfile = {
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: avatarUrl(row.user_id, row),
    level: row.level,
    topics,
    joinedAt: row.joined_at,
    // Learning progress has no table yet (path progress ships separately); these fill in then.
    stats: null,
    completedPaths: row.show_paths === 1 ? [] : null,
    submissions,
  };
  return c.json({ profile });
});

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "Shared resource";
  }
}

const USER_ID = /^[A-Za-z0-9_-]{8,64}$/;

// The photo. Public profiles are open to everyone; a private profile's photo only to its owner.
publicProfiles.get("/avatars/:userId", async (c) => {
  const userId = c.req.param("userId");
  const missing = () => c.json(notFound(), 404);
  if (!USER_ID.test(userId)) return missing();
  const row = await c.env.DB.prepare(
    "SELECT avatar, avatar_type, is_public FROM profiles WHERE user_id = ? AND avatar_type IS NOT NULL",
  )
    .bind(userId)
    .first<{ avatar: unknown; avatar_type: string; is_public: number }>();
  const bytes = row ? toBytes(row.avatar) : null;
  if (!row || !bytes) return missing();
  let cache = "public, max-age=31536000, immutable";
  if (row.is_public !== 1) {
    const session = await getAuth(c.env)
      .api.getSession({ headers: c.req.raw.headers })
      .catch(() => null);
    if (session?.user.id !== userId) return missing();
    cache = "private, max-age=3600";
  }
  return new Response(bytes, {
    headers: {
      "Content-Type": row.avatar_type,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Cache-Control": cache,
    },
  });
});
