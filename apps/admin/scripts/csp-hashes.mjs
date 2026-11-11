// Runs after `next build`: hashes every inline <script> in each exported page and writes
// worker/csp-hashes.json ({ "/paths": ["<base64 sha256>", ...], ... }). The site Worker turns a
// page's hashes into its Content-Security-Policy (worker/security.ts), so inline scripts run only
// if they are exactly the ones the build produced. Commit the regenerated file with the build.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out");

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name))
      : entry.name.endsWith(".html")
        ? [join(dir, entry.name)]
        : [],
  );

/** "index.html" -> "/", "paths/ui-ux.html" -> "/paths/ui-ux", "404.html" -> "/404". */
const keyOf = (file) => {
  const path = `/${relative(out, file)
    .replaceAll("\\", "/")
    .replace(/\.html$/, "")}`;
  return path === "/index" ? "/" : path.replace(/\/index$/, "") || "/";
};

const EXECUTABLE = new Set(["", "text/javascript", "application/javascript", "module"]);
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;

const map = {};
for (const file of walk(out).sort()) {
  const html = readFileSync(file, "utf8");
  const hashes = new Set();
  for (const [, attrs, body] of html.matchAll(SCRIPT)) {
    if (/\ssrc\s*=/.test(attrs)) continue; // external: allowed by 'self'
    const type = /\stype\s*=\s*["']?([^"'\s>]+)/.exec(attrs)?.[1]?.toLowerCase() ?? "";
    if (!EXECUTABLE.has(type)) continue; // data blocks such as JSON-LD are not executed
    if (body.trim() === "") continue;
    hashes.add(createHash("sha256").update(body, "utf8").digest("base64"));
  }
  map[keyOf(file)] = [...hashes].sort();
}

writeFileSync(join(root, "worker", "csp-hashes.json"), `${JSON.stringify(map, null, 2)}\n`);
const pages = Object.keys(map).length;
const most = Math.max(...Object.values(map).map((h) => h.length));
console.log(`csp-hashes: ${pages} pages, up to ${most} inline scripts each`);
