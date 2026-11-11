"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import {
  METRIC_TABS,
  type MetricTab,
  TAB_LABEL,
  exportMetrics,
  saveBlob,
} from "../../lib/dash/api";
import { withRange } from "../../lib/dash/hooks";
import { type DashRange, previousLabel } from "../../lib/dash/range";
import { DateRangeMenu } from "./date-range";
import { ExportIcon } from "./icons";
import { BUTTON, FOCUS, PageHeader } from "./ui";

/** Chip row linking the five metrics tabs; the range travels in the address. */
export function TabChips({ active, range }: { active: MetricTab; range: DashRange }) {
  return (
    <nav aria-label="Metrics sections" className="-mx-1 overflow-x-auto px-1 py-1">
      <ul className="flex gap-2">
        {METRIC_TABS.map((tab) => {
          const current = tab === active;
          return (
            <li key={tab}>
              <Link
                href={withRange(`/metrics/${tab}`, range)}
                aria-current={current ? "page" : undefined}
                className={`inline-flex h-9 items-center whitespace-nowrap rounded-full border px-4 text-[14px] leading-5 transition-colors ${FOCUS} ${
                  current
                    ? "border-ink bg-ink text-bg-base"
                    : "border-border-alpha text-text hover:bg-bg-fill1"
                }`}
              >
                {TAB_LABEL[tab]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ExportButton({
  tab,
  range,
  disabled,
}: {
  tab: MetricTab;
  range: DashRange;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(null), 10_000);
    return () => clearTimeout(timer);
  }, [failed]);

  const run = async () => {
    setBusy(true);
    setFailed(null);
    const result = await exportMetrics(tab, range);
    setBusy(false);
    if (result.ok) saveBlob(result.data);
    else {
      setFailed(
        result.code === "network_error"
          ? "We couldn’t reach the server, so the CSV wasn’t created."
          : result.code === "forbidden"
            ? "Your role can’t export these numbers."
            : "The CSV wasn’t created. Try again in a moment.",
      );
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={disabled || busy}
        aria-busy={busy}
        className={`${BUTTON} ${FOCUS}`}
      >
        <ExportIcon />
        {busy ? "Exporting..." : "Export CSV"}
      </button>
      {failed ? (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-[440px] items-center justify-between gap-3 rounded-2xl border border-error-border bg-error-accent px-4 py-3 text-[14px] leading-5 text-error-text shadow-lg"
        >
          <span>
            <span className="block font-medium">Export failed</span>
            {failed}
          </span>
          <span className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={run}
              className={`rounded font-medium underline ${FOCUS}`}
            >
              Retry
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setFailed(null)}
              className={`rounded ${FOCUS}`}
            >
              {"✕"}
            </button>
          </span>
        </div>
      ) : null}
    </>
  );
}

/** Title, range menu, export and tab chips shared by every metrics screen. */
export function MetricsFrame({
  tab,
  range,
  onRange,
  canExport,
  children,
}: {
  tab: MetricTab;
  range: DashRange;
  onRange: (next: DashRange) => void;
  canExport: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Metrics"
        subtitle={`Compared with the ${previousLabel(range)}.`}
        actions={
          <>
            <DateRangeMenu range={range} onChange={onRange} />
            <ExportButton tab={tab} range={range} disabled={!canExport} />
          </>
        }
      />
      <TabChips active={tab} range={range} />
      {children}
    </div>
  );
}
