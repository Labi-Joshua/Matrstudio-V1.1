import type { Bindings } from "../env";
import { sendAlertEmail } from "../lib/email";

// Workers Free limits (daily, reset 00:00 UTC). Keep in sync with the quota table in the docs.
const LIMITS = { requests: 100_000, rowsRead: 5_000_000, rowsWritten: 100_000 } as const;
const LEVELS = [80, 95] as const;

const QUERY = /* GraphQL */ `
  query Usage($accountTag: string!, $start: string!, $end: string!, $day: string!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        workersInvocationsAdaptive(limit: 1000, filter: { datetime_geq: $start, datetime_leq: $end }) {
          sum { requests }
        }
        d1AnalyticsAdaptiveGroups(limit: 1000, filter: { date_geq: $day, date_leq: $day }) {
          sum { rowsRead rowsWritten }
        }
      }
    }
  }
`;

type UsageResponse = {
  data?: {
    viewer: {
      accounts: Array<{
        workersInvocationsAdaptive: Array<{ sum: { requests: number } }>;
        d1AnalyticsAdaptiveGroups: Array<{ sum: { rowsRead: number; rowsWritten: number } }>;
      }>;
    };
  };
  errors?: unknown[];
};

async function fetchUsage(env: Bindings, now: Date) {
  const day = now.toISOString().slice(0, 10);
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        accountTag: env.CF_ACCOUNT_ID,
        start: `${day}T00:00:00Z`,
        end: now.toISOString(),
        day,
      },
    }),
  });
  if (!res.ok) throw new Error(`GraphQL usage query failed with HTTP ${res.status}`);
  const json = (await res.json()) as UsageResponse;
  const account = json.data?.viewer.accounts[0];
  if (!account) throw new Error(`GraphQL usage query failed: ${JSON.stringify(json.errors)}`);

  const sum = <T>(rows: T[], pick: (r: T) => number) => rows.reduce((n, r) => n + pick(r), 0);
  return {
    day,
    usage: {
      requests: sum(account.workersInvocationsAdaptive, (r) => r.sum.requests),
      rowsRead: sum(account.d1AnalyticsAdaptiveGroups, (r) => r.sum.rowsRead),
      rowsWritten: sum(account.d1AnalyticsAdaptiveGroups, (r) => r.sum.rowsWritten),
    },
  };
}

/**
 * Runs from the cron trigger. Alerts once per (day, metric, threshold) to every configured
 * destination: a Slack/Discord-style webhook and/or an email through Resend.
 */
export async function checkUsage(env: Bindings): Promise<void> {
  // Not configured yet: skip quietly instead of logging a failed GraphQL call every 30 minutes.
  if (!env.CF_API_TOKEN || !(env.ALERT_WEBHOOK_URL || env.ALERT_EMAIL)) return;
  const { day, usage } = await fetchUsage(env, new Date());

  for (const metric of Object.keys(LIMITS) as Array<keyof typeof LIMITS>) {
    const pct = (usage[metric] / LIMITS[metric]) * 100;
    for (const level of LEVELS) {
      if (pct < level) continue;

      // INSERT OR IGNORE: changes === 1 only the first time this threshold is crossed today.
      const res = await env.DB.prepare(
        "INSERT OR IGNORE INTO ops_alerts (day, metric, level) VALUES (?1, ?2, ?3)",
      )
        .bind(day, metric, level)
        .run();
      if (res.meta.changes !== 1) continue;

      const text = `Matr Studio: ${metric} at ${pct.toFixed(0)}% of the free daily limit (${usage[metric].toLocaleString("en-US")} / ${LIMITS[metric].toLocaleString("en-US")}). Resets 00:00 UTC.`;
      if (env.ALERT_WEBHOOK_URL) {
        await fetch(env.ALERT_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, text }), // Discord reads "content", Slack reads "text"
        });
      }
      await sendAlertEmail(env, `Matr Studio usage alert: ${metric} at ${level}%`, text);
    }
  }
}
