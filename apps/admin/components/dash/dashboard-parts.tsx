import Link from "next/link";
import { relativeTime } from "../../lib/dash/format";
import type { AttentionItem, QueueItem } from "../../lib/dash/types";
import { ClockIcon, InboxIcon } from "./icons";
import { Bar, Card, CardHeader, EmptyNote, FOCUS, LINK_ACCENT } from "./ui";

export function AttentionBar({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Needs attention"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-warning-accent px-5 py-3.5 text-[13px] leading-5 text-warning-text"
    >
      <span className="flex items-center gap-2 font-medium">
        <ClockIcon />
        Needs attention
      </span>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-1.5">
            <span aria-hidden="true">{"•"}</span>
            <span>{item.text}</span>
            <Link
              href={item.href}
              className={`rounded font-medium underline-offset-2 hover:underline ${FOCUS}`}
            >
              {item.linkLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const ACTION: Record<QueueItem["kind"], string> = {
  submission: "Review",
  broken_link: "Fix",
  help_request: "Reply",
  profile_report: "Review",
};

export type Row = {
  key: string;
  title: string;
  sub: string;
  /** Amber sub line (past its target). */
  warn?: boolean;
  href: string | null;
  action: string;
  /** "Over target" chip instead of the action link. */
  chip?: string;
};

function Rows({ rows }: { rows: Row[] }) {
  return (
    <ul className="divide-y divide-border-soft-alpha">
      {rows.map((row) => {
        const inner = (
          <>
            <span className="min-w-0">
              <span className="block truncate text-[14px] leading-5 text-text">{row.title}</span>
              <span
                className={`block truncate text-[12px] leading-4 ${row.warn ? "text-warning-text" : "text-text-secondary"}`}
              >
                {row.sub}
              </span>
            </span>
            {row.chip ? (
              <span className="shrink-0 rounded-md bg-error-focus px-2 py-0.5 text-[12px] leading-4 text-error-text">
                {row.chip}
              </span>
            ) : (
              <span className="shrink-0 text-[13px] leading-5 text-primary-text">{row.action}</span>
            )}
          </>
        );
        return (
          <li key={row.key}>
            {row.href ? (
              <Link
                href={row.href}
                className={`flex min-h-[56px] items-center justify-between gap-3 rounded-lg py-2.5 hover:bg-bg-fill1 ${FOCUS}`}
              >
                {inner}
              </Link>
            ) : (
              <div className="flex min-h-[56px] items-center justify-between gap-3 py-2.5">
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ListPanel({
  title,
  rows,
  seeAll,
  emptyTitle,
  emptyBody,
}: {
  title: string;
  rows: Row[];
  seeAll?: { href: string; label?: string };
  emptyTitle: string;
  emptyBody: string;
}) {
  return (
    <Card label={title}>
      <CardHeader
        title={title}
        action={
          seeAll ? (
            <Link href={seeAll.href} className={LINK_ACCENT}>
              {seeAll.label ?? "See all"}
            </Link>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <EmptyNote compact icon={<InboxIcon />} title={emptyTitle} body={emptyBody} />
      ) : (
        <Rows rows={rows} />
      )}
    </Card>
  );
}

export function queueRows(items: QueueItem[]): Row[] {
  return items.map((q) => ({
    key: q.id,
    title: q.title,
    sub: q.meta,
    warn: q.overTarget,
    href: q.href,
    action: ACTION[q.kind],
    chip: q.overTarget ? "Over target" : undefined,
  }));
}

export function activityRows(
  items: {
    id: string;
    actor: string;
    action: string;
    detail: string;
    at: string;
    href: string | null;
  }[],
): Row[] {
  return items.map((a) => {
    const when = relativeTime(a.at);
    return {
      key: a.id,
      title: `${a.actor} ${a.action}`,
      sub: [a.detail, when].filter(Boolean).join(" · "),
      href: a.href,
      action: "View",
    };
  });
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden="true" className="rounded-2xl border border-border-alpha p-5">
      <Bar className="mb-4 h-4 w-32" />
      {range(rows).map((i) => (
        <div
          key={i}
          className="flex items-center justify-between border-t border-border-soft-alpha py-3 first:border-0"
        >
          <div>
            <Bar className="h-4 w-40" />
            <Bar className="mt-2 h-3 w-28" />
          </div>
          <Bar className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
