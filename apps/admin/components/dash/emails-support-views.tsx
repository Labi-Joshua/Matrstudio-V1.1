"use client";

import { getEmails, getSupport } from "../../lib/dash/api";
import { formatCount, formatPercent } from "../../lib/dash/format";
import type { EmailsMetrics, SupportMetrics } from "../../lib/dash/types";
import { BarRows, BarRowsSkeleton } from "./bar-rows";
import { MetricsTabPage } from "./metrics-page";
import { StatGrid, StatGridSkeleton } from "./stats";
import { TD, TH, TableShell, TableSkeleton } from "./table";
import { Bar, Card, CardHeader } from "./ui";

const rate = (v: number | null) => (v === null ? "—" : formatPercent(v));

export function EmailsView() {
  return (
    <MetricsTabPage
      tab="emails"
      load={getEmails}
      isEmpty={(d: EmailsMetrics) =>
        d.rows.every((r) => r.sent === 0) && d.stats.every((s) => s.value === 0)
      }
      skeleton={
        <>
          <StatGridSkeleton />
          <TableSkeleton rows={5} cols={5} />
        </>
      }
    >
      {(data) => (
        <>
          <StatGrid stats={data.stats} />
          <TableShell
            caption="Emails sent, opened and clicked"
            minWidth={640}
            head={
              <>
                <th scope="col" className={TH}>
                  Email
                </th>
                <th scope="col" className={TH}>
                  Sent
                </th>
                <th scope="col" className={TH}>
                  Opened
                </th>
                <th scope="col" className={TH}>
                  Clicked
                </th>
                <th scope="col" className={TH}>
                  Result
                </th>
              </>
            }
          >
            {data.rows.map((row) => (
              <tr key={row.template}>
                <th scope="row" className={`${TD} text-left font-normal`}>
                  {row.template}
                </th>
                <td className={TD}>{formatCount(row.sent)}</td>
                <td className={TD}>{rate(row.openedRate)}</td>
                <td className={TD}>{rate(row.clickedRate)}</td>
                <td className={TD}>{row.result ?? "—"}</td>
              </tr>
            ))}
          </TableShell>
        </>
      )}
    </MetricsTabPage>
  );
}

function CountCard({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <Card label={title}>
      <CardHeader title={title} />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-text-secondary">
          Nothing yet for this range.
        </p>
      ) : (
        <BarRows
          items={rows.map((r) => ({
            key: r.label,
            label: r.label,
            value: r.count,
            display: formatCount(r.count),
          }))}
          labelWidth={180}
          valueWidth={48}
        />
      )}
    </Card>
  );
}

export function SupportView() {
  return (
    <MetricsTabPage
      tab="support"
      load={getSupport}
      isEmpty={(d: SupportMetrics) =>
        d.stats.every((s) => s.value === 0) && d.byTopic.length === 0 && d.problems.length === 0
      }
      skeleton={
        <>
          <StatGridSkeleton />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl border border-border-alpha p-5">
                <Bar className="mb-4 h-4 w-32" />
                <BarRowsSkeleton rows={4} />
              </div>
            ))}
          </div>
        </>
      }
    >
      {(data) => (
        <>
          <StatGrid stats={data.stats} />
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <CountCard title="Requests by topic" rows={data.byTopic} />
            <CountCard title="Problem reports by type" rows={data.problems} />
          </div>
        </>
      )}
    </MetricsTabPage>
  );
}
