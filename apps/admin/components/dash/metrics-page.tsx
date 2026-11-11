"use client";

import type { ReactNode } from "react";
import type { ApiResult } from "../../lib/api";
import type { MetricTab } from "../../lib/dash/api";
import { type Remote, useRange, useRemote, useSkeletonGate } from "../../lib/dash/hooks";
import { type DashRange, rangeLabel, rangeQuery } from "../../lib/dash/range";
import { ChartIcon } from "./icons";
import { MetricsFrame } from "./metrics-frame";
import { Card, EmptyNote, ErrorPanel, Status } from "./ui";

/**
 * One metrics tab: range, loading (delayed skeleton), error with retry, "no data for this range",
 * then the tab's own content.
 */
export function MetricsTabPage<T>({
  tab,
  load,
  isEmpty,
  skeleton,
  children,
}: {
  tab: MetricTab;
  load: (range: DashRange, signal: AbortSignal) => Promise<ApiResult<T>>;
  isEmpty: (data: T) => boolean;
  skeleton: ReactNode;
  children: (data: T, range: DashRange, remote: Remote<T>) => ReactNode;
}) {
  const { range, ready, setRange } = useRange();
  const remote = useRemote((signal) => load(range, signal), rangeQuery(range), ready);
  const showSkeleton = useSkeletonGate(remote.status === "loading");
  const { data, status } = remote;

  let body: ReactNode = null;
  if (status === "error") {
    body = (
      <ErrorPanel
        title={"We couldn’t load these numbers"}
        body="They will be back shortly. Try again in a moment."
        error={remote.error}
        onRetry={remote.reload}
      />
    );
  } else if (showSkeleton) {
    body = (
      <>
        <Status>Loading metrics</Status>
        {skeleton}
      </>
    );
  } else if (data && isEmpty(data)) {
    body = (
      <Card>
        <EmptyNote
          icon={<ChartIcon />}
          title="No data for this date range"
          body="Pick a longer range, or check back once learners start."
        />
      </Card>
    );
  } else if (data) {
    body = (
      <>
        <Status>Metrics for {rangeLabel(range)}</Status>
        {children(data, range, remote)}
      </>
    );
  }

  return (
    <MetricsFrame tab={tab} range={range} onRange={setRange} canExport={status === "ok" && !!data}>
      {body}
    </MetricsFrame>
  );
}
