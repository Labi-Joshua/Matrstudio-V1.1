import type { AdminArea } from "@matr/types";

/**
 * Adds a notification to the admin portal's bell. It is shown to every admin whose role holds `area`
 * at View or above (no `area` = every admin). Keep titles and bodies free of personal data: name the
 * thing ("3 links need fixing"), never a person's contact details.
 */
export async function createAdminNotification(
  db: D1Database,
  n: { kind: string; title: string; body?: string; href?: string; area?: AdminArea },
): Promise<void> {
  try {
    await db
      .prepare(
        "INSERT INTO admin_notifications (kind, title, body, href, area, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())",
      )
      .bind(
        n.kind.slice(0, 40),
        n.title.slice(0, 160),
        (n.body ?? "").slice(0, 400),
        n.href ?? null,
        n.area ?? null,
      )
      .run();
  } catch (err) {
    // A missed bell entry must never break the action that raised it.
    console.error("admin notification failed", err instanceof Error ? err.name : "error");
  }
}
