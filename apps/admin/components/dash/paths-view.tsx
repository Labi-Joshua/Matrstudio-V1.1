"use client";

import Link from "next/link";
import { getPaths } from "../../lib/dash/api";
import { formatCount, formatMinutes, formatPercent } from "../../lib/dash/format";
import { withRange } from "../../lib/dash/hooks";
import type { PathsMetrics } from "../../lib/dash/types";
import { CheckIcon } from "./icons";
import { MetricsTabPage } from "./metrics-page";
import { TD, TH, TableShell, TableSkeleton } from "./table";
import { FOCUS, LINK_ACCENT } from "./ui";

/** Below this completion rate a path is flagged. */
const LOW_COMPLETION = 20;

export function CompletionChip({ rate }: { rate: number }) {
  const low = rate < LOW_COMPLETION;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] leading-4 ${
        low ? "bg-error-focus text-error-text" : "bg-success-focus text-success-text"
      }`}
    >
      {low ? <span aria-hidden="true">!</span> : <CheckIcon />}
      <span className="sr-only">{low ? "Low: " : "On track: "}</span>
      {formatPercent(rate)}
    </span>
  );
}

export function PathsView() {
  return (
    <MetricsTabPage
      tab="paths"
      load={getPaths}
      isEmpty={(d: PathsMetrics) => d.rows.length === 0 || d.rows.every((r) => r.started === 0)}
      skeleton={<TableSkeleton rows={6} cols={5} />}
    >
      {(data, range) => (
        <TableShell
          caption="Paths: started, completion, average time and biggest drop-off"
          minWidth={680}
          head={
            <>
              <th scope="col" className={TH}>
                Path
              </th>
              <th scope="col" className={TH}>
                Started
              </th>
              <th scope="col" className={TH}>
                Completion
              </th>
              <th scope="col" className={TH}>
                Avg. time
              </th>
              <th scope="col" className={TH}>
                Biggest drop-off
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Details</span>
              </th>
            </>
          }
        >
          {data.rows.map((row) => (
            <tr key={row.id} className="hover:bg-bg-fill1">
              <th scope="row" className={`${TD} text-left font-normal`}>
                <span className="block">{row.title}</span>
                <span className="block text-[12px] leading-4 text-text-secondary">
                  {row.lessons} {row.lessons === 1 ? "lesson" : "lessons"}
                </span>
              </th>
              <td className={TD}>{formatCount(row.started)}</td>
              <td className={TD}>
                <CompletionChip rate={row.completionRate} />
              </td>
              <td className={TD}>
                {row.avgMinutes === null ? "—" : formatMinutes(row.avgMinutes)}
              </td>
              <td className={TD}>
                {row.dropLesson === null
                  ? "—"
                  : `Lesson ${row.dropLesson}${row.dropPct === null ? "" : ` · −${Math.round(row.dropPct)}%`}`}
              </td>
              <td className={`${TD} text-right`}>
                <Link
                  href={withRange(`/metrics/paths/detail?id=${encodeURIComponent(row.id)}`, range)}
                  className={`${LINK_ACCENT} ${FOCUS}`}
                >
                  View<span className="sr-only"> {row.title}</span>
                </Link>
              </td>
            </tr>
          ))}
        </TableShell>
      )}
    </MetricsTabPage>
  );
}
