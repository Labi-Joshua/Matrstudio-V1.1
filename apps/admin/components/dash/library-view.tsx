"use client";

import Link from "next/link";
import { useState } from "react";
import { dismissSearchTerm, getLibrary } from "../../lib/dash/api";
import { formatCount, lastSearched } from "../../lib/dash/format";
import type { LibraryMetrics, TopItem } from "../../lib/dash/types";
import { BarRows, BarRowsSkeleton } from "./bar-rows";
import { MetricsTabPage } from "./metrics-page";
import { TD, TH, TableShell, TableSkeleton } from "./table";
import { Bar, Card, CardHeader, EmptyNote, FOCUS, LINK_ACCENT } from "./ui";

const isEmpty = (d: LibraryMetrics) =>
  d.mostOpened.length === 0 && d.mostSaved.length === 0 && d.noResults.length === 0;

function TopCard({ title, items }: { title: string; items: TopItem[] }) {
  return (
    <Card label={title}>
      <CardHeader
        title={title}
        action={
          <Link href="/resources" className={LINK_ACCENT}>
            See all
          </Link>
        }
      />
      {items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-text-secondary">
          Nothing yet for this range.
        </p>
      ) : (
        <BarRows
          items={items.map((i) => ({
            key: i.id,
            label: i.title,
            value: i.count,
            display: formatCount(i.count),
          }))}
          labelWidth={180}
          valueWidth={56}
        />
      )}
    </Card>
  );
}

function NoResults({
  rows,
  onChange,
}: {
  rows: LibraryMetrics["noResults"];
  onChange: (next: LibraryMetrics["noResults"]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const dismiss = async (term: string) => {
    setBusy(term);
    setError(null);
    const result = await dismissSearchTerm(term);
    setBusy(null);
    if (result.ok) onChange(rows.filter((r) => r.term !== term));
    else setError(`We couldn’t dismiss “${term}”. Try again.`);
  };

  return (
    <section aria-label="Searches with no results" className="flex flex-col gap-3">
      <h2 className="text-[14px] font-normal leading-5 text-text">Searches with no results</h2>
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-error-accent px-4 py-2 text-[13px] text-error-text"
        >
          {error}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <Card>
          <EmptyNote
            compact
            title="No empty searches"
            body="Searches that find nothing show up here."
          />
        </Card>
      ) : (
        <TableShell
          caption="Searches with no results"
          minWidth={560}
          head={
            <>
              <th scope="col" className={TH}>
                Search term
              </th>
              <th scope="col" className={TH}>
                Searches
              </th>
              <th scope="col" className={TH}>
                Last searched
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </>
          }
        >
          {rows.map((row) => (
            <tr key={row.term} className="hover:bg-bg-fill1">
              <th scope="row" className={`${TD} text-left font-normal`}>
                {row.term}
              </th>
              <td className={TD}>{formatCount(row.count)}</td>
              <td className={TD}>{lastSearched(row.lastAt)}</td>
              <td className={`${TD} text-right`}>
                <span className="inline-flex items-center gap-4">
                  <Link
                    href={`/resources/new?title=${encodeURIComponent(row.term)}`}
                    className={`rounded text-text hover:underline ${FOCUS}`}
                  >
                    Add resource<span className="sr-only"> for {row.term}</span>
                  </Link>
                  <button
                    type="button"
                    disabled={busy === row.term}
                    onClick={() => dismiss(row.term)}
                    className={`rounded text-error-text hover:underline disabled:opacity-50 ${FOCUS}`}
                  >
                    Dismiss<span className="sr-only"> {row.term}</span>
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </TableShell>
      )}
    </section>
  );
}

export function LibraryView() {
  return (
    <MetricsTabPage
      tab="library"
      load={getLibrary}
      isEmpty={isEmpty}
      skeleton={
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl border border-border-alpha p-5">
                <Bar className="mb-4 h-4 w-28" />
                <BarRowsSkeleton rows={4} />
              </div>
            ))}
          </div>
          <TableSkeleton rows={4} cols={4} />
        </>
      }
    >
      {(data, _range, remote) => (
        <>
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <TopCard title="Most opened" items={data.mostOpened} />
            <TopCard title="Most saved" items={data.mostSaved} />
          </div>
          <NoResults
            rows={data.noResults}
            onChange={(noResults) => remote.setData({ ...data, noResults })}
          />
        </>
      )}
    </MetricsTabPage>
  );
}
