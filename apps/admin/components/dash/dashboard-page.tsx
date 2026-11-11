"use client";

import Link from "next/link";
import { getDashboard } from "../../lib/dash/api";
import { useRange, useRemote, useSkeletonGate, withRange } from "../../lib/dash/hooks";
import { type DashRange, previousLabel, rangeLabel, rangeQuery } from "../../lib/dash/range";
import type { Dashboard } from "../../lib/dash/types";
import {
  AttentionBar,
  ListPanel,
  PanelSkeleton,
  type Row,
  activityRows,
  queueRows,
} from "./dashboard-parts";
import { DateRangeMenu } from "./date-range";
import { ChartSkeleton, LineChart } from "./line-chart";
import { StatGrid, StatGridSkeleton } from "./stats";
import { Bar, Card, CardHeader, ErrorPanel, LINK_ACCENT, PageHeader, Status } from "./ui";

function greeting(name: string | null, now = new Date()): string {
  const h = now.getHours();
  const part = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return `Good ${part}${name ? `, ${name}` : ""}.`;
}

function subtitleOf(data: Dashboard | undefined): string {
  if (!data) return "Here’s what needs attention.";
  if (data.firstTime) {
    return "Welcome to Matr Studio Admin. Numbers appear here once learners start using the platform.";
  }
  return data.headline ?? `${greeting(data.firstName)} Here’s what needs attention.`;
}

const METRICS_LINK: Record<Dashboard["variant"], string> = {
  admin: "/metrics/learners",
  curator: "/metrics/library",
  support: "/metrics/support",
};

function DashboardBody({ data, range }: { data: Dashboard; range: DashRange }) {
  const first = data.firstTime;
  const panels: React.ReactNode[] = [];
  if (data.noResultSearches) {
    const rows: Row[] = data.noResultSearches.map((s) => ({
      key: s.term,
      title: s.term,
      sub: `${s.count} ${s.periodLabel}`,
      href: `/resources/new?title=${encodeURIComponent(s.term)}`,
      action: "Add resource",
    }));
    panels.push(
      <ListPanel
        key="no-results"
        title="Searches with no results"
        rows={rows}
        seeAll={{ href: withRange("/metrics/library", range) }}
        emptyTitle="No empty searches"
        emptyBody="Searches that find nothing show up here."
      />,
    );
  }
  if (data.recentActivity) {
    panels.push(
      <ListPanel
        key="activity"
        title="Recent admin activity"
        rows={activityRows(data.recentActivity)}
        seeAll={{ href: "/audit" }}
        emptyTitle="No activity yet"
        emptyBody="Changes made by admins show up here."
      />,
    );
  }
  if (data.atRisk) {
    panels.push(
      <ListPanel
        key="at-risk"
        title="Accounts that may need help"
        rows={data.atRisk.map((a) => ({
          key: a.id,
          title: a.email,
          sub: a.reason,
          href: a.href,
          action: "Open",
        }))}
        seeAll={{ href: "/users" }}
        emptyTitle="No accounts need help"
        emptyBody="Unconfirmed or locked accounts show up here."
      />,
    );
  }

  return (
    <>
      <AttentionBar items={first ? [] : data.attention} />
      <StatGrid stats={data.stats} note={`vs ${previousLabel(range)}`} empty={first} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {data.series ? (
          <Card label={data.series.title} className="self-start">
            <CardHeader
              title={data.series.title}
              action={
                <Link href={withRange(METRICS_LINK[data.variant], range)} className={LINK_ACCENT}>
                  Open in Metrics
                </Link>
              }
            />
            <LineChart
              series={data.series}
              emptyTitle="No activity yet"
              emptyBody="Invite people from the waitlist to get started."
            />
          </Card>
        ) : null}
        <ListPanel
          title={data.queueTitle}
          rows={queueRows(data.queue)}
          seeAll={{
            href: data.variant === "support" ? "/support" : "/review/submissions",
          }}
          emptyTitle="Nothing waiting"
          emptyBody="Submissions and help requests show up here."
        />
      </div>
      {panels.length > 0 ? (
        <div className={`grid grid-cols-1 gap-4 ${panels.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {panels}
        </div>
      ) : null}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <Status>Loading the dashboard</Status>
      <div aria-hidden="true" className="h-12 rounded-2xl bg-bg-fill1 motion-safe:animate-pulse" />
      <StatGridSkeleton withNote />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div aria-hidden="true" className="rounded-2xl border border-border-alpha p-5">
          <Bar className="mb-4 h-4 w-48" />
          <ChartSkeleton />
        </div>
        <PanelSkeleton rows={4} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={3} />
      </div>
    </>
  );
}

export function DashboardPage() {
  const { range, ready, setRange } = useRange();
  const remote = useRemote((signal) => getDashboard(range, signal), rangeQuery(range), ready);
  const showSkeleton = useSkeletonGate(remote.status === "loading");
  const { data, status } = remote;

  return (
    <div className="flex flex-col gap-4 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Dashboard"
        subtitle={subtitleOf(status === "error" ? undefined : data)}
        actions={<DateRangeMenu range={range} onChange={setRange} />}
      />
      {status === "error" ? (
        <ErrorPanel
          title={"We couldn’t load the dashboard"}
          body="The numbers will be back shortly. Try again in a moment."
          error={remote.error}
          onRetry={remote.reload}
        />
      ) : showSkeleton ? (
        <DashboardSkeleton />
      ) : data ? (
        <>
          <Status>Dashboard for {rangeLabel(range)}</Status>
          <DashboardBody data={data} range={range} />
        </>
      ) : null}
    </div>
  );
}
