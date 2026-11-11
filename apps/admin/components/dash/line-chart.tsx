"use client";

import { type KeyboardEvent, type PointerEvent, useEffect, useId, useState } from "react";
import { linePath, niceScale, xAt } from "../../lib/dash/chart-math";
import { formatCount } from "../../lib/dash/format";
import type { Series } from "../../lib/dash/types";
import { EmptyNote, FOCUS } from "./ui";
import { ChartIcon } from "./icons";

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };
const CURRENT = "var(--color-primary)";
const PREVIOUS = "var(--color-text-secondary)";

function useWidth() {
  const [node, ref] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!node) return;
    const update = () => setWidth(Math.floor(node.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return { ref, width };
}

const total = (values: (number | null)[]) => values.reduce<number>((a, v) => a + (v ?? 0), 0);

/** One-sentence text alternative: totals, the peak and how it compares. */
export function describeSeries(series: Series): string {
  const cur = total(series.current);
  const prev = total(series.previous);
  let peak = 0;
  series.current.forEach((v, i) => {
    if ((v ?? -1) > (series.current[peak] ?? -1)) peak = i;
  });
  const peakText =
    series.current[peak] === null || series.current[peak] === undefined
      ? ""
      : ` Highest on ${series.labels[peak]} with ${formatCount(series.current[peak] ?? 0)}.`;
  return `${series.title}. This period ${formatCount(cur)} in total, previous period ${formatCount(prev)}.${peakText}`;
}

function Legend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] leading-4 text-text-secondary">
      <li className="flex items-center gap-1.5">
        <svg width="16" height="8" aria-hidden="true">
          <line
            x1="0"
            y1="4"
            x2="16"
            y2="4"
            stroke={CURRENT}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        This period
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="16" height="8" aria-hidden="true">
          <line
            x1="0"
            y1="4"
            x2="16"
            y2="4"
            stroke={PREVIOUS}
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
        </svg>
        Previous period
      </li>
    </ul>
  );
}

export function SeriesTable({ series }: { series: Series }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px] leading-5">
        <caption className="sr-only">{series.title}</caption>
        <thead>
          <tr className="border-b border-border-alpha text-text-secondary">
            <th scope="col" className="py-2 pr-4 font-normal">
              Day
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">
              This period
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              Previous period
            </th>
          </tr>
        </thead>
        <tbody>
          {series.labels.map((label, i) => (
            <tr key={label} className="border-b border-border-soft-alpha last:border-0">
              <th scope="row" className="py-2 pr-4 font-normal text-text">
                {label}
              </th>
              <td className="py-2 pr-4 text-right tabular-nums">
                {series.current[i] === null ? "—" : formatCount(series.current[i] ?? 0)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {series.previous[i] === null ? "—" : formatCount(series.previous[i] ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * This period against the previous one, as an inline SVG line chart. Hover or arrow keys read one
 * point at a time; "View as table" swaps in the same numbers as a table.
 */
export function LineChart({
  series,
  emptyTitle = "No activity yet",
  emptyBody = "Numbers appear here once learners start using the platform.",
}: {
  series: Series | null;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const { ref, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const descId = useId();

  const hasData =
    series !== null && [...series.current, ...series.previous].some((v) => (v ?? 0) > 0);
  if (!series || !hasData) {
    return <EmptyNote icon={<ChartIcon />} title={emptyTitle} body={emptyBody} />;
  }

  const count = series.labels.length;
  const peak = Math.max(
    ...series.current.map((v) => v ?? 0),
    ...series.previous.map((v) => v ?? 0),
  );
  const scale = niceScale(peak);
  const left = PAD.left;
  const right = Math.max(left + 40, width - PAD.right);
  const bottom = HEIGHT - PAD.bottom;
  const y = (v: number) => bottom - (v / scale.max) * (bottom - PAD.top);
  const pts = (values: (number | null)[]) =>
    values.map((v, i) => (v === null ? null : { x: xAt(i, count, left, right), y: y(v) }));
  const curPts = pts(series.current);
  const prevPts = pts(series.previous);

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    let best = 0;
    for (let i = 1; i < count; i++) {
      if (Math.abs(xAt(i, count, left, right) - px) < Math.abs(xAt(best, count, left, right) - px))
        best = i;
    }
    setActive(best);
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") setActive((a) => Math.min(count - 1, (a ?? -1) + 1));
    else if (event.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? count) - 1));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(count - 1);
    else if (event.key === "Escape") setActive(null);
    else return;
    event.preventDefault();
  };

  const ax = active === null ? null : xAt(active, count, left, right);
  const tipValue = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : formatCount(v);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className={`rounded text-[12px] leading-4 text-text-secondary underline-offset-2 hover:text-text hover:underline ${FOCUS}`}
        >
          {asTable ? "View as chart" : "View as table"}
        </button>
      </div>
      {asTable ? (
        <SeriesTable series={series} />
      ) : (
        <figure
          ref={ref}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: arrow keys read the points one by one
          tabIndex={0}
          aria-label={`${series.title}. Use the left and right arrow keys to read each day.`}
          aria-describedby={descId}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? 0)}
          onBlur={() => setActive(null)}
          className={`relative m-0 rounded-lg ${FOCUS}`}
          style={{ height: HEIGHT }}
        >
          <p id={descId} className="sr-only">
            {describeSeries(series)}
          </p>
          {width > 0 ? (
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={describeSeries(series)}
              onPointerMove={onPointer}
              onPointerLeave={() => setActive(null)}
              className="block touch-pan-y"
            >
              {scale.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={left}
                    x2={right}
                    y1={y(t)}
                    y2={y(t)}
                    stroke="var(--color-border-soft-alpha)"
                    strokeWidth="1"
                  />
                  <text
                    x={left - 8}
                    y={y(t)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize="12"
                    fill="var(--color-text-secondary)"
                  >
                    {formatCount(t)}
                  </text>
                </g>
              ))}
              {series.labels.map((label, i) => (
                <text
                  key={label}
                  x={xAt(i, count, left, right)}
                  y={HEIGHT - 8}
                  textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"}
                  fontSize="12"
                  fill="var(--color-text-secondary)"
                >
                  {label}
                </text>
              ))}
              {ax === null ? null : (
                <line
                  x1={ax}
                  x2={ax}
                  y1={PAD.top}
                  y2={bottom}
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
              )}
              <path
                d={linePath(prevPts)}
                fill="none"
                stroke={PREVIOUS}
                strokeWidth="2"
                strokeDasharray="5 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={linePath(curPts)}
                fill="none"
                stroke={CURRENT}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {count <= 14
                ? curPts.map((p, i) =>
                    p ? (
                      <circle
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={i === active ? 5 : 3.5}
                        fill={i === active ? CURRENT : "var(--color-bg-base)"}
                        stroke={CURRENT}
                        strokeWidth="2"
                      />
                    ) : null,
                  )
                : null}
              {active !== null && prevPts[active] ? (
                <circle
                  cx={prevPts[active]?.x}
                  cy={prevPts[active]?.y}
                  r="4"
                  fill={PREVIOUS}
                  stroke="var(--color-bg-base)"
                  strokeWidth="2"
                />
              ) : null}
            </svg>
          ) : null}
          {active !== null && ax !== null ? (
            <div
              role="status"
              className="pointer-events-none absolute top-2 z-10 min-w-[150px] rounded-xl border border-border-alpha bg-bg-base px-3 py-2 text-[12px] leading-4 shadow-[0_4px_16px_rgba(9,10,11,0.12)]"
              style={{ left: Math.min(Math.max(ax + 12, 0), Math.max(0, width - 170)) }}
            >
              <p className="mb-1 font-medium text-text">{series.labels[active]}</p>
              <p className="flex justify-between gap-4 text-text-secondary">
                <span>This period</span>
                <span className="text-text tabular-nums">{tipValue(series.current[active])}</span>
              </p>
              <p className="flex justify-between gap-4 text-text-secondary">
                <span>Previous period</span>
                <span className="text-text tabular-nums">{tipValue(series.previous[active])}</span>
              </p>
            </div>
          ) : null}
        </figure>
      )}
      <Legend />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="h-[220px] rounded-lg bg-bg-fill1 motion-safe:animate-pulse"
    />
  );
}
