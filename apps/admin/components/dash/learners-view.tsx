"use client";

import { getLearners } from "../../lib/dash/api";
import { formatCount, percentOf } from "../../lib/dash/format";
import type { LearnersMetrics } from "../../lib/dash/types";
import { BarRows, BarRowsSkeleton } from "./bar-rows";
import { ChartSkeleton, LineChart } from "./line-chart";
import { MetricsTabPage } from "./metrics-page";
import { StatGrid, StatGridSkeleton } from "./stats";
import { Bar, Card, CardHeader } from "./ui";

const isEmpty = (d: LearnersMetrics) =>
  d.stats.every((s) => s.value === 0) && d.funnel.every((f) => f.count === 0);

function Funnel({ funnel }: { funnel: LearnersMetrics["funnel"] }) {
  const items = funnel.map((step, i) => {
    const before = funnel[i - 1];
    const share = before
      ? `${formatCount(step.count)} · ${percentOf(step.count, before.count)}%`
      : formatCount(step.count);
    return { key: step.label, label: step.label, value: step.count, display: share };
  });
  return (
    <Card label="Sign-up funnel">
      <CardHeader title="Sign-up funnel" />
      <BarRows items={items} max={funnel[0]?.count} labelWidth={150} valueWidth={110} />
      <p className="mt-3 text-[12px] leading-4 text-text-tertiary">
        Percentages are the share of the step before.
      </p>
    </Card>
  );
}

export function LearnersView() {
  return (
    <MetricsTabPage
      tab="learners"
      load={getLearners}
      isEmpty={isEmpty}
      skeleton={
        <>
          <StatGridSkeleton />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-border-alpha p-5">
              <Bar className="mb-4 h-4 w-32" />
              <BarRowsSkeleton rows={4} />
            </div>
            <div className="rounded-2xl border border-border-alpha p-5">
              <Bar className="mb-4 h-4 w-40" />
              <ChartSkeleton />
            </div>
          </div>
        </>
      }
    >
      {(data) => (
        <>
          <StatGrid stats={data.stats} />
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <Funnel funnel={data.funnel} />
            <Card label={data.weekly?.title ?? "Weekly active learners"}>
              <CardHeader title={data.weekly?.title ?? "Weekly active learners"} />
              <LineChart
                series={data.weekly}
                emptyTitle="No weekly data yet"
                emptyBody="The line appears once learners are active."
              />
            </Card>
          </div>
        </>
      )}
    </MetricsTabPage>
  );
}
