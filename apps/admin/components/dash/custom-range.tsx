"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  WEEKDAYS,
  WEEKDAY_NAMES,
  addMonths,
  monthGrid,
  monthOf,
  monthTitle,
  shiftDay,
} from "../../lib/dash/calendar";
import { useModalSurface } from "../../lib/dash/hooks";
import {
  type DashRange,
  inclusiveDays,
  shortDay,
  toIsoDay,
  validateCustomRange,
} from "../../lib/dash/range";
import { ChevronIcon } from "./icons";
import { BUTTON, FOCUS } from "./ui";

function longDay(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Calendar({
  from,
  to,
  today,
  onPick,
}: {
  from: string | null;
  to: string | null;
  today: string;
  onPick: (day: string) => void;
}) {
  const start = to ?? from ?? today;
  const [month, setMonth] = useState(monthOf(start));
  const [focusDay, setFocusDay] = useState(start);
  const gridRef = useRef<HTMLTableElement>(null);
  const moved = useRef(false);

  // After an arrow key the roving button takes DOM focus (not on first render).
  // biome-ignore lint/correctness/useExhaustiveDependencies: focusDay is the trigger
  useEffect(() => {
    if (!moved.current) return;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [focusDay, month]);

  const move = (day: string) => {
    if (day > today) return;
    moved.current = true;
    setFocusDay(day);
    setMonth(monthOf(day));
  };
  const onKey = (event: KeyboardEvent<HTMLTableElement>) => {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const delta = step[event.key];
    if (delta !== undefined) {
      move(shiftDay(focusDay, delta));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      const target = addMonths(monthOf(focusDay), event.key === "PageUp" ? -1 : 1);
      const day = `${target.year}-${String(target.month + 1).padStart(2, "0")}-${focusDay.slice(8)}`;
      move(day > today ? today : day);
    } else return;
    event.preventDefault();
  };

  const rows = monthGrid(month);
  const next = addMonths(month, 1);
  const nextDisabled = toIsoDay(new Date(next.year, next.month, 1)) > today;
  const focusMonth = monthOf(focusDay);
  const focusShown = focusMonth.year === month.year && focusMonth.month === month.month;
  const inRange = (d: string) => from !== null && to !== null && d >= from && d <= to;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className={`flex size-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-fill2 ${FOCUS}`}
        >
          <ChevronIcon dir="left" />
        </button>
        <p aria-live="polite" className="text-[14px] font-medium text-text">
          {monthTitle(month)}
        </p>
        <button
          type="button"
          aria-label="Next month"
          disabled={nextDisabled}
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className={`flex size-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-fill2 disabled:opacity-40 ${FOCUS}`}
        >
          <ChevronIcon dir="right" />
        </button>
      </div>
      <table
        ref={gridRef}
        aria-label={monthTitle(month)}
        onKeyDown={onKey}
        className="w-full border-collapse"
      >
        <thead>
          <tr>
            {WEEKDAYS.map((w, i) => (
              <th
                key={w}
                scope="col"
                abbr={WEEKDAY_NAMES[i]}
                className="h-8 text-[12px] font-normal text-text-secondary"
              >
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.find(Boolean) ?? "pad"}>
              {row.map((day, i) => {
                // biome-ignore lint/suspicious/noArrayIndexKey: padding cells have no id
                if (!day) return <td key={`p${i}`} />;
                const selected = day === from || day === to;
                const future = day > today;
                const roving = focusShown ? day === focusDay : day.endsWith("-01");
                return (
                  <td
                    key={day}
                    className={`p-0 ${inRange(day) && !selected ? "bg-primary-accent" : ""}`}
                  >
                    <button
                      type="button"
                      data-day={day}
                      tabIndex={roving ? 0 : -1}
                      disabled={future}
                      aria-pressed={selected}
                      aria-label={longDay(day)}
                      onClick={() => {
                        setFocusDay(day);
                        onPick(day);
                      }}
                      className={`mx-auto flex size-9 items-center justify-center rounded-lg text-[13px] tabular-nums ${FOCUS} ${
                        selected
                          ? "bg-primary text-static-white"
                          : future
                            ? "text-text-tertiary opacity-50"
                            : "text-text hover:bg-bg-fill2"
                      }`}
                    >
                      {Number(day.slice(8))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Modal for "Custom range...": pick a first and a last day, then apply. */
export function CustomRangeDialog({
  initial,
  onApply,
  onClose,
}: {
  initial: DashRange;
  onApply: (range: DashRange) => void;
  onClose: () => void;
}) {
  const today = toIsoDay(new Date());
  const [from, setFrom] = useState<string | null>(
    initial.key === "custom" ? (initial.from ?? null) : null,
  );
  const [to, setTo] = useState<string | null>(
    initial.key === "custom" ? (initial.to ?? null) : null,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  useModalSurface(panelRef, onClose);

  const pick = (day: string) => {
    if (from === null || to !== null) {
      setFrom(day);
      setTo(null);
    } else if (day < from) {
      setFrom(day);
    } else setTo(day);
  };
  const error = from && to ? validateCustomRange(from, to, today) : null;
  const ready = from !== null && to !== null && error === null;
  const summary =
    from && to
      ? `${shortDay(from)} – ${shortDay(to)} (${inclusiveDays(from, to)} days)`
      : from
        ? `${shortDay(from)} – pick the last day`
        : "Pick the first day";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-static-black/60 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-range-title"
        className="w-full max-w-[400px] rounded-t-2xl bg-bg-base p-5 shadow-xl sm:rounded-2xl"
      >
        <h2 id="custom-range-title" className="text-[18px] font-medium leading-7 text-text">
          Custom range
        </h2>
        <p className="mb-4 text-[13px] leading-5 text-text-secondary">
          Numbers are compared with the same number of days before it.
        </p>
        <Calendar from={from} to={to} today={today} onPick={pick} />
        <p role="status" className="mt-3 text-[13px] leading-5 text-text">
          {summary}
        </p>
        {error ? (
          <p role="alert" className="text-[13px] leading-5 text-error-text">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${BUTTON} ${FOCUS}`}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => from && to && onApply({ key: "custom", from, to })}
            className={`inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-[14px] leading-5 text-static-white disabled:opacity-50 ${FOCUS}`}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
