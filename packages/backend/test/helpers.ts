import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { vi } from "vitest";
import type { Bindings } from "../src/env";
import worker from "../src/index";
import type { AuthEmailMessage } from "../src/lib/auth-email-templates";

// A D1 look-alike over node:sqlite (real SQLite), so the migrations, Better Auth's SQL, the
// Kysely D1 dialect and our own queries all run for real in tests.
class Stmt {
  constructor(
    private readonly sqlite: DatabaseSync,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}
  bind(...params: unknown[]) {
    return new Stmt(this.sqlite, this.sql, params);
  }
  private exec() {
    const args = this.params.map((p) =>
      p === undefined ? null : typeof p === "boolean" ? Number(p) : p,
    ) as SQLInputValue[];
    const st = this.sqlite.prepare(this.sql);
    const rows = st.all(...args) as Record<string, unknown>[];
    const meta = this.sqlite
      .prepare("SELECT changes() AS changes, last_insert_rowid() AS id")
      .get() as {
      changes: number;
      id: number;
    };
    return { rows, meta: { changes: meta.changes, last_row_id: meta.id } };
  }
  async all() {
    const { rows, meta } = this.exec();
    return { success: true, results: rows, meta };
  }
  async run() {
    const { meta } = this.exec();
    return { success: true, results: [], meta };
  }
  async first(col?: string) {
    const row = this.exec().rows[0] ?? null;
    return col && row ? row[col] : row;
  }
  async raw() {
    return this.exec().rows.map((r) => Object.values(r));
  }
}

export function createD1(): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  const dir = join(import.meta.dirname, "..", "migrations");
  for (const f of readdirSync(dir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(join(dir, f), "utf8"));
  }
  const db = {
    prepare: (sql: string) => new Stmt(sqlite, sql),
    async batch(stmts: Stmt[]) {
      sqlite.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        sqlite.exec("COMMIT");
        return out;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Database;
  return { db, sqlite };
}

export const ORIGIN = "https://matrstudio.com";
export const GOOD_PASSWORD = "correct horse battery staple 42";

export type TestApp = ReturnType<typeof createApp>;

export function createApp(overrides: Partial<Bindings> = {}) {
  const { db, sqlite } = createD1();
  const emails: AuthEmailMessage[] = [];
  const env = {
    DB: db,
    AUTH_EMAIL_QUEUE: { send: async (m: AuthEmailMessage) => void emails.push(m) },
    ENVIRONMENT: "development",
    ALLOWED_ORIGINS: "https://matrstudio.com,https://www.matrstudio.com",
    PUBLIC_WEB_URL: "https://matrstudio.com",
    PUBLIC_API_URL: "https://matrstudio.com",
    EMAIL_FROM: "Matr Studio <hello@matrstudio.com>",
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
    PASSWORD_SCRYPT_N: "1024",
    AUTH_MIN_RESPONSE_MS: "60",
    ...overrides,
  } as unknown as Bindings;
  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

  type CallOpts = {
    method?: string;
    body?: unknown;
    cookie?: string;
    origin?: string | null;
    headers?: Record<string, string>;
  };
  async function call(path: string, opts: CallOpts = {}) {
    const headers = new Headers({
      "user-agent": "Mozilla/5.0 (Macintosh) Chrome/120.0 Safari/537.36",
    });
    if (opts.origin !== null) headers.set("origin", opts.origin ?? ORIGIN);
    if (opts.body !== undefined) headers.set("content-type", "application/json");
    if (opts.cookie) headers.set("cookie", opts.cookie);
    for (const [k, v] of Object.entries(opts.headers ?? {})) headers.set(k, v);
    const res = await worker.fetch(
      new Request(`https://matrstudio.com${path}`, {
        method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        redirect: "manual",
      }),
      env,
      ctx,
    );
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text);
    } catch {}
    const setCookies = res.headers.getSetCookie();
    const session = setCookies.find((c) => c.startsWith("__Host-ms_session="));
    return {
      status: res.status,
      json,
      text,
      headers: res.headers,
      setCookies,
      /** "name=value" of the session cookie if this response set (or cleared) it. */
      cookie: session?.split(";")[0],
    };
  }

  const last = <T extends AuthEmailMessage["type"]>(type: T) =>
    [...emails].reverse().find((e) => e.type === type) as
      | Extract<AuthEmailMessage, { type: T }>
      | undefined;

  /** Creates a confirmed account through the real endpoints and returns a signed-in cookie. */
  async function signUpConfirmed(email: string, password = GOOD_PASSWORD, name = "Ada Obi") {
    const up = await call("/api/auth/sign-up/email", { body: { email, password, name } });
    if (up.status !== 200) throw new Error(`sign-up failed ${up.status} ${up.text}`);
    const msg = last("confirm-email");
    if (!msg) throw new Error("no confirmation email queued");
    const verify = await call(new URL(msg.link).pathname + new URL(msg.link).search, {
      origin: null,
    });
    return { signUp: up, verify, link: msg.link, cookie: verify.cookie };
  }

  async function signIn(
    email: string,
    password = GOOD_PASSWORD,
    extra: Record<string, string> = {},
  ) {
    return call("/api/auth/sign-in/email", { body: { email, password }, headers: extra });
  }

  return { env, db, sqlite, emails, call, last, signUpConfirmed, signIn };
}

/** Stubs global fetch: HIBP says "not breached" unless a handler says otherwise. */
export function stubFetch(handler?: (url: string, init?: RequestInit) => Response | undefined) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const custom = handler?.(url, init);
    if (custom) return custom;
    if (url.includes("pwnedpasswords.com"))
      return new Response("0000000000000000000000000000000000A:1\r\n");
    if (url.includes("challenges.cloudflare.com")) return Response.json({ success: true });
    return new Response("not stubbed", { status: 500 });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
