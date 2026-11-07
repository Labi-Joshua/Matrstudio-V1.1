import type { DBAdapter, Where } from "@better-auth/core/db/adapter";
import { sha256Hex } from "./util";

// Session token hashing (docs/SECURITY-AUTH.md section 3).
//
// Better Auth hands the plain session token to the cookie and looks sessions up by it. This layer
// sits between Better Auth and the real database adapter so the database only ever holds
// "sha256:<hex of SHA-256(token)>":
//   - create:  data.token (plain) is hashed on the way in; the returned row carries the plain token
//              back so the cookie and the response bodies are unchanged.
//   - lookups: where token = X (plain) becomes where token = hash(X); the returned row's token is
//              set back to X.
//   - update / delete / consume: same mapping.
//   - Reads that do not go through a token (by userId, by id) return the stored hash. A hash is
//     never usable as a credential: lookups ALWAYS hash their input, so presenting a stored hash
//     as a cookie value just hashes it again and finds nothing.
//   - Deletes and updates accept an already-hashed value ("sha256:" prefix) untouched. Better Auth's
//     "revoke other sessions" reads tokens from the database and deletes by them, which would
//     otherwise hash twice.
//
// It also enforces the absolute session lifetime: Better Auth slides expiresAt forward on use
// (idle timeout); this caps it at createdAt + absoluteMs.
export const SESSION_HASH_PREFIX = "sha256:";

export const hashSessionToken = async (token: string) =>
  SESSION_HASH_PREFIX + (await sha256Hex(token));
const isHashed = (v: unknown): v is string =>
  typeof v === "string" && v.startsWith(SESSION_HASH_PREFIX);

type Row = Record<string, unknown>;

export type SessionHashOptions = {
  /** Absolute session lifetime in ms (30 days for learners). */
  absoluteMs: number;
};

export function withHashedSessionTokens(
  inner: DBAdapter,
  opts: SessionHashOptions,
  sessionModel = "session",
): DBAdapter {
  const isSession = (model: string) => model === sessionModel;

  /** Maps token clauses to hashes. Returns the new where plus plain-by-hash for restoring results. */
  async function mapWhere(
    where: Where[] | undefined,
    allowHashedInput: boolean,
  ): Promise<{ where: Where[] | undefined; plain: Map<string, string> }> {
    const plain = new Map<string, string>();
    if (!where) return { where, plain };
    const out: Where[] = [];
    for (const clause of where) {
      if (clause.field !== "token") {
        out.push(clause);
        continue;
      }
      const conv = async (v: unknown) => {
        if (typeof v !== "string") return v;
        if (allowHashedInput && isHashed(v)) return v;
        const h = await hashSessionToken(v);
        plain.set(h, v);
        return h;
      };
      const value = Array.isArray(clause.value)
        ? await Promise.all(clause.value.map(conv))
        : await conv(clause.value);
      out.push({ ...clause, value } as Where);
    }
    return { where: out, plain };
  }

  const restore = <T>(row: T, plain: Map<string, string>): T => {
    if (!row || typeof row !== "object") return row;
    const r = row as Row;
    if (typeof r.token === "string" && plain.has(r.token)) {
      return { ...r, token: plain.get(r.token) } as T;
    }
    return row;
  };

  /** Applies the absolute cap to an expiresAt update. */
  async function capExpiry(
    where: Where[],
    update: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!(update.expiresAt instanceof Date) && typeof update.expiresAt !== "string") return update;
    const row = await inner.findOne<Row>({ model: sessionModel, where });
    if (!row) return update;
    const created = new Date(row.createdAt as string | number | Date).getTime();
    if (!Number.isFinite(created)) return update;
    const cap = created + opts.absoluteMs;
    const wanted = new Date(update.expiresAt as string | Date).getTime();
    return wanted > cap ? { ...update, expiresAt: new Date(cap) } : update;
  }

  const wrapped: DBAdapter = {
    ...inner,
    async create(args) {
      if (!isSession(args.model)) return inner.create(args);
      const data = { ...(args.data as Row) };
      const token = data.token;
      if (typeof token !== "string") return inner.create(args);
      data.token = await hashSessionToken(token);
      const row = await inner.create({ ...args, data: data as never });
      return restore(row, new Map([[data.token as string, token]])) as never;
    },
    async findOne(args) {
      if (!isSession(args.model)) return inner.findOne(args);
      const { where, plain } = await mapWhere(args.where, false);
      return restore(await inner.findOne({ ...args, where: where as Where[] }), plain) as never;
    },
    async findMany(args) {
      if (!isSession(args.model)) return inner.findMany(args);
      const { where, plain } = await mapWhere(args.where, false);
      const rows = await inner.findMany({ ...args, where });
      return rows.map((r) => restore(r, plain)) as never;
    },
    async count(args) {
      if (!isSession(args.model)) return inner.count(args);
      const { where } = await mapWhere(args.where, false);
      return inner.count({ ...args, where });
    },
    async update(args) {
      if (!isSession(args.model)) return inner.update(args);
      const { where, plain } = await mapWhere(args.where, true);
      let update = { ...args.update };
      if (typeof update.token === "string" && !isHashed(update.token)) {
        const h = await hashSessionToken(update.token);
        plain.set(h, update.token);
        update.token = h;
      }
      update = await capExpiry(where as Where[], update);
      return restore(
        await inner.update({ ...args, where: where as Where[], update }),
        plain,
      ) as never;
    },
    async updateMany(args) {
      if (!isSession(args.model)) return inner.updateMany(args);
      const { where } = await mapWhere(args.where, true);
      return inner.updateMany({ ...args, where: where as Where[] });
    },
    async delete(args) {
      if (!isSession(args.model)) return inner.delete(args);
      const { where } = await mapWhere(args.where, true);
      return inner.delete({ ...args, where: where as Where[] });
    },
    async deleteMany(args) {
      if (!isSession(args.model)) return inner.deleteMany(args);
      const { where } = await mapWhere(args.where, true);
      return inner.deleteMany({ ...args, where: where as Where[] });
    },
    async consumeOne(args) {
      if (!isSession(args.model)) return inner.consumeOne(args);
      const { where, plain } = await mapWhere(args.where, true);
      return restore(await inner.consumeOne({ ...args, where: where as Where[] }), plain) as never;
    },
    async incrementOne(args) {
      if (!isSession(args.model)) return inner.incrementOne(args);
      const { where, plain } = await mapWhere(args.where, true);
      return restore(
        await inner.incrementOne({ ...args, where: where as Where[] }),
        plain,
      ) as never;
    },
    transaction: (cb) =>
      inner.transaction((trx) => cb(withHashedSessionTokens(trx as DBAdapter, opts, sessionModel))),
  };
  return wrapped;
}
