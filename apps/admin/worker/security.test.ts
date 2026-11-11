import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, routeKey, withSecurityHeaders } from "./security";

describe("contentSecurityPolicy", () => {
  const csp = contentSecurityPolicy(["abc123=", "def456="]);
  const directive = (name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

  it("lists this page's inline script hashes and nothing like unsafe-inline for scripts", () => {
    const script = directive("script-src");
    expect(script).toContain("'sha256-abc123='");
    expect(script).toContain("'sha256-def456='");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(script).toContain("'self'");
  });

  it("locks down framing, forms, base URI and plugins", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it("only allows Turnstile as an outside origin", () => {
    const origins = csp.match(/https:\/\/[a-z.]+/g) ?? [];
    expect(new Set(origins)).toEqual(new Set(["https://challenges.cloudflare.com"]));
  });

  it("works with no hashes (an unknown page): scripts then run only from this site", () => {
    const bare = contentSecurityPolicy([]);
    expect(bare).toContain("script-src 'self' https://challenges.cloudflare.com");
  });
});

describe("routeKey", () => {
  it("maps paths to csp-hashes.json keys", () => {
    expect(routeKey("/")).toBe("/");
    expect(routeKey("/paths")).toBe("/paths");
    expect(routeKey("/paths/")).toBe("/paths");
    expect(routeKey("/paths/ui-ux")).toBe("/paths/ui-ux");
  });
});

describe("withSecurityHeaders", () => {
  const html = () =>
    new Response("<p>hi</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } });

  it("adds HSTS, nosniff, referrer and permissions policies to every response", () => {
    const res = withSecurityHeaders(
      new Response("x", { headers: { "Content-Type": "image/svg+xml" } }),
      [],
    );
    expect(res.headers.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
  });

  it("adds the CSP only to HTML documents", () => {
    expect(withSecurityHeaders(html(), ["h="]).headers.get("Content-Security-Policy")).toContain(
      "'sha256-h='",
    );
    const css = new Response("a{}", { headers: { "Content-Type": "text/css" } });
    expect(withSecurityHeaders(css, []).headers.get("Content-Security-Policy")).toBeNull();
  });

  it("keeps the status and body", async () => {
    const res = withSecurityHeaders(
      new Response("nope", { status: 404, headers: { "Content-Type": "text/html" } }),
      [],
    );
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("nope");
  });
});
