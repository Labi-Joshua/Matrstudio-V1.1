import {
  type OwnProfile,
  RESERVED_USERNAMES,
  USERNAME_MAX,
  USERNAME_MIN,
  usernameSchema,
} from "@matr/types";

export type ProfileRow = {
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_type: string | null;
  avatar_updated_at: number | null;
  is_public: number;
  show_stats: number;
  show_paths: number;
  show_submissions: number;
  created_at: number;
  updated_at: number;
};

// Never SELECT * : the avatar blob stays out of every profile query but the avatar route.
export const PROFILE_COLUMNS =
  "user_id, username, display_name, bio, avatar_type, avatar_updated_at, is_public, show_stats, show_paths, show_submissions, created_at, updated_at";

const reserved = new Set(RESERVED_USERNAMES);
export const isReserved = (username: string) => reserved.has(username);

export type UsernameProblem = "invalid" | "reserved";
/** The normalised username, or why it cannot be used. Availability is a separate, database check. */
export function checkUsername(
  raw: unknown,
): { ok: true; username: string } | { ok: false; reason: UsernameProblem } {
  const parsed = usernameSchema.safeParse(typeof raw === "string" ? raw : "");
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (isReserved(parsed.data)) return { ok: false, reason: "reserved" };
  return { ok: true, username: parsed.data };
}

export const avatarUrl = (
  userId: string,
  row: Pick<ProfileRow, "avatar_type" | "avatar_updated_at">,
) =>
  row.avatar_type
    ? `/api/avatars/${encodeURIComponent(userId)}?v=${row.avatar_updated_at ?? 0}`
    : null;

const iso = (sec: number) => new Date(sec * 1000).toISOString();

export const toOwnProfile = (row: ProfileRow): OwnProfile => ({
  username: row.username,
  displayName: row.display_name,
  bio: row.bio,
  avatarUrl: avatarUrl(row.user_id, row),
  isPublic: row.is_public === 1,
  visibility: {
    stats: row.show_stats === 1,
    paths: row.show_paths === 1,
    submissions: row.show_submissions === 1,
  },
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

function suggestUsername(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, USERNAME_MAX - 5);
  return base.length >= USERNAME_MIN && !isReserved(base) ? base : "learner";
}

const digits = () => {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String((n[0] ?? 0) % 10000).padStart(4, "0");
};

/**
 * The learner's profile, created on first use with a username derived from their name (never from
 * their email), then a random suffix when that is taken. Idempotent and race-safe: the insert
 * ignores conflicts and the row is read back.
 */
export async function ensureProfile(
  db: D1Database,
  user: { id: string; name: string },
): Promise<ProfileRow> {
  const select = () =>
    db
      .prepare(`SELECT ${PROFILE_COLUMNS} FROM profiles WHERE user_id = ?`)
      .bind(user.id)
      .first<ProfileRow>();
  const existing = await select();
  if (existing) return existing;
  const base = suggestUsername(user.name);
  const now = Math.floor(Date.now() / 1000);
  for (let attempt = 0; attempt < 8; attempt++) {
    const username = attempt === 0 ? base : `${base}${digits()}`;
    await db
      .prepare(
        `INSERT INTO profiles (user_id, username, display_name, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4) ON CONFLICT DO NOTHING`,
      )
      .bind(
        user.id,
        isReserved(username) ? `${base}${digits()}` : username,
        user.name.trim().slice(0, 60),
        now,
      )
      .run();
    const row = await select();
    if (row) return row;
  }
  throw new Error("could not allocate a username");
}

/** D1 returns blobs as number arrays, node:sqlite as Uint8Array. */
export const toBytes = (v: unknown): Uint8Array | null =>
  v instanceof Uint8Array
    ? v
    : Array.isArray(v)
      ? Uint8Array.from(v as number[])
      : v instanceof ArrayBuffer
        ? new Uint8Array(v)
        : null;

/** Image type from the first bytes, so a lying Content-Type or file name proves nothing. */
export function sniffImage(b: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((x, k) => b[i + k] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}
