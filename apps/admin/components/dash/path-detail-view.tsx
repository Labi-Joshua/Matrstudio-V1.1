"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPathDetail } from "../../lib/dash/api";
import { formatCount, percentOf } from "../../lib/dash/format";
import { useRange, useRemote, useSkeletonGate, withRange } from "../../lib/dash/hooks";
import { rangeLabel, rangeQuery } from "../../lib/dash/range";
import { BarRows, BarRowsSkeleton } from "./bar-rows";
import { ArrowLeftIcon, ChartIcon, ClockIcon, SlidersIcon } from "./icons";
import { StatGrid, StatGridSkeleton } from "./stats";
import { Bar, Card, CardHeader, EmptyNote, ErrorPanel, FOCUS, PageHeader, Status } from "./ui";
import { DateRangeMenu } from "./date-range";

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** /metrics/paths/detail?id=: where learners stop, lesson by lesson. */
export function PathDetailView() {
  const { range, ready, setRange } = useRange();
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id")), []);

  const remote = useRemote(
    (signal) => getPathDetail(id ?? "", range, signal),
    `${id}|${rangeQuery(range)}`,
    ready && !!id,
  );
  const showSkeleton = useSkeletonGate(remote.status === "loading" && !!id);
  const { data, status } = remote;

  const back = (
    <Link
      href={withRange("/metrics/paths", range)}
      className={`inline-flex items-center gap-2 self-start rounded text-[14px] leading-5 text-text hover:underline ${FOCUS}`}
    >
      <ArrowLeftIcon />
      Paths
    </Link>
  );

  let body: React.ReactNode = null;
  if (id === null) {
    body = (
      <Card>
        <EmptyNote
          icon={<ChartIcon />}
          title="No path chosen"
          body="Open a path from the Paths tab to see where learners stop."
        />
      </Card>
    );
  } else if (status === "error") {
    body = (
      <ErrorPanel
        title={"We couldn’t load this path"}
        body="The numbers will be back shortly. Try again in a moment."
        error={remote.error}
        onRetry={remote.reload}
      />
    );
  } else if (showSkeleton) {
    body = (
      <>
        <Status>Loading path metrics</Status>
        <StatGridSkeleton />
        <div className="rounded-2xl border border-border-alpha p-5">
          <Bar className="mb-4 h-4 w-56" />
          <BarRowsSkeleton rows={8} />
        </div>
      </>
    );
  } else if (data) {
    const first = data.steps[0]?.count ?? 0;
    const items = data.steps.map((s) => ({
      key: String(s.number),
      label: s.title ? `Lesson ${s.number} · ${s.title}` : `Lesson ${s.number}`,
      value: s.count,
      display: `${formatCount(s.count)} · ${percentOf(s.count, first)}%`,
      highlight: data.biggestDrop?.lesson === s.number,
    }));
    const drop = data.biggestDrop;
    body = (
      <>
        <StatGrid stats={data.stats} />
        <Card label="Learners still going, lesson by lesson">
          <CardHeader title="Learners still going, lesson by lesson" />
          {items.length === 0 || first === 0 ? (
            <EmptyNote
              compact
              icon={<ChartIcon />}
              title="No data for this date range"
              body="Pick a longer range, or check back once learners start."
            />
          ) : (
            <BarRows items={items} max={first} labelWidth={200} valueWidth={110} />
          )}
          {drop ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-accent px-4 py-3 text-[13px] leading-5 text-warning-text">
              <p className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  <ClockIcon />
                </span>
                <span>
                  Biggest drop: {Math.round(drop.pct)}% of learners stop after lesson {drop.lesson}.
                  {drop.note ? ` ${drop.note}` : ""}
                </span>
              </p>
              <Link
                href={`/paths/detail?id=${encodeURIComponent(data.id)}&lesson=${drop.lesson}`}
                className={`rounded font-medium text-primary-text hover:underline ${FOCUS}`}
              >
                Open lesson {drop.lesson}
              </Link>
            </div>
          ) : null}
        </Card>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6 md:px-8 md:py-8">
      {back}
      <PageHeader
        title={data?.title ?? "Path metrics"}
        subtitle={
          data
            ? [
                `${data.lessons} ${data.lessons === 1 ? "lesson" : "lessons"}`,
                data.level,
                lower(rangeLabel(range)),
              ]
                .filter(Boolean)
                .join(" · ")
            : lower(rangeLabel(range))
        }
        actions={
          <>
            <DateRangeMenu range={range} onChange={setRange} />
            {id ? (
              <Link
                href={`/paths/detail?id=${encodeURIComponent(id)}`}
                className={`inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-[14px] leading-5 text-bg-base ${FOCUS}`}
              >
                <SlidersIcon />
                Open in path editor
              </Link>
            ) : null}
          </>
        }
      />
      {body}
    </div>
  );
}
