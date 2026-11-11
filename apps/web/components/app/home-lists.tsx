"use client";

import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import { SECTION_TIPS } from "../../lib/app/dashboard";
import { recentSubmissions } from "../../lib/app/home-data";
import { buildLibraryModel, safeResourceUrl } from "../../lib/app/library-data";
import { resolveSaved } from "../../lib/app/saved-state";
import { STATUS_PRESENTATION, type StatusTone, submissionDetail } from "../../lib/app/submit-state";
import { hostLabel } from "../../lib/app/submit-url";
import type { Submission } from "../../lib/auth/submissions-api";
import { getCatalogue } from "../../lib/catalogue/data";
import { ROUTES } from "../../lib/routes";
import { ArticleIcon, ExternalIcon, PlayIcon, ToolIcon, TypeBadge } from "../app-library/art";
import { useSaved } from "../app-saved/saved-provider";
import { useSubmissions } from "../app-submit/use-submissions";
import { SectionHeader } from "./home-parts";
import { useSkeletonGate } from "./hooks";
import { ArrowRightIcon, UploadIcon } from "./icons";
import { FOCUS } from "./ui";

/**
 * The Saved and Your submissions sections of Home (Figma "Learning in progress" / "Welcome back"):
 * the newest few of each, with View all linking to the full screen. Each has its own loading,
 * "couldn't load" and empty state, so one failing API never blanks the page. `quiet` (a learner
 * with nothing started) hides a section until it has something to show.
 */
const PREVIEW = 4;
const ROW =
  "flex items-center gap-3 rounded-xl border border-border-soft bg-bg-base py-3 pr-3.5 pl-3";
const ICON_BOX =
  "flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary";
const KIND_ICON = { video: PlayIcon, article: ArticleIcon, tool: ToolIcon } as const;

const TONE: Record<StatusTone, { badge: string; dot: string }> = {
  amber: { badge: "bg-warning-focus text-warning-text", dot: "bg-warning-text" },
  green: { badge: "bg-success-focus text-success-text", dot: "bg-success-text" },
  orange: { badge: "bg-primary-focus text-primary-text", dot: "bg-primary-text" },
  red: { badge: "bg-error-focus text-error-text", dot: "bg-error-text" },
};

function ListShell({
  id,
  title,
  tip,
  action,
  children,
}: {
  id: string;
  title: string;
  tip: string;
  action?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <SectionHeader id={id} title={title} tip={tip} action={action} />
      {children}
    </section>
  );
}

function RowSkeleton({ visible }: { visible: boolean }) {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading
      </p>
      {visible ? (
        <div aria-hidden="true" className="grid gap-3 md:grid-cols-2">
          {["a", "b"].map((key) => (
            <div key={key} className="h-[66px] rounded-xl bg-bg-fill2 motion-safe:animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="h-[66px]" />
      )}
    </div>
  );
}

function Empty({
  title,
  body,
  link,
}: {
  title: string;
  body: string;
  link: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-2xl border border-border border-dashed bg-bg-fill1 p-5">
      <p className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">{title}</p>
      <p className="max-w-[480px] text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        {body}
      </p>
      <Link
        href={link.href}
        className={`link-slide inline-flex items-center gap-1 rounded-md font-semibold text-[14px] text-primary-text leading-5 tracking-[-0.14px] ${FOCUS}`}
      >
        {link.label}
        <ArrowRightIcon size={14} />
      </Link>
    </div>
  );
}

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-border-soft bg-bg-fill1 p-4"
    >
      <p className="flex-1 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        We couldn’t load {what}. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={`btn-lift inline-flex h-9 items-center rounded-lg border border-border bg-bg-base px-3 font-medium text-[14px] text-text leading-5 ${FOCUS}`}
      >
        Try again
      </button>
    </div>
  );
}

export function SavedSection({ quiet = false }: { quiet?: boolean }) {
  const { status, ids, reload } = useSaved();
  const model = useMemo(() => buildLibraryModel(getCatalogue()), []);
  const items = useMemo(() => resolveSaved(ids, model.items), [ids, model.items]);
  const gate = useSkeletonGate(status === "loading");
  if (quiet && status !== "error" && items.length === 0) return null;
  return (
    <ListShell
      id="saved-heading"
      title="Saved"
      tip={SECTION_TIPS.saved}
      action={items.length > 0 ? { label: "See all saved", href: ROUTES.app.saved } : undefined}
    >
      {status === "loading" ? (
        <RowSkeleton visible={gate} />
      ) : status === "error" ? (
        <LoadError what="your saved resources" onRetry={reload} />
      ) : items.length === 0 ? (
        <Empty
          title="Nothing saved yet"
          body="Tap the bookmark on any resource to keep it here for later."
          link={{ label: "Browse the library", href: ROUTES.app.library }}
        />
      ) : (
        <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0 md:grid-cols-2">
          {items.slice(0, PREVIEW).map((item) => {
            const Icon = KIND_ICON[item.kind];
            const url = safeResourceUrl(item.url);
            const meta = [item.sourceName, item.lengthLabel].filter(Boolean).join(" · ");
            return (
              <li key={item.id} className={`${ROW} relative`}>
                <span aria-hidden="true" className={ICON_BOX}>
                  <Icon size={20} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link
                    href={`${ROUTES.app.library}/${item.id}`}
                    className={`truncate rounded-sm font-semibold text-[14px] text-text leading-5 tracking-[-0.14px] after:absolute after:inset-0 after:rounded-xl ${FOCUS}`}
                  >
                    {item.title}
                  </Link>
                  <p className="truncate text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
                    {meta}
                  </p>
                </div>
                <TypeBadge kind={item.kind} />
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${item.title} on ${item.sourceName} (new tab)`}
                    className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-md text-primary-text hover:bg-primary-focus ${FOCUS}`}
                  >
                    <ExternalIcon size={18} />
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </ListShell>
  );
}

function SubmissionRow({ submission }: { submission: Submission }) {
  const topics = useMemo(() => getCatalogue().topics, []);
  const topicName = topics.find((t) => t.slug === submission.topic)?.name ?? null;
  const title = submission.title?.trim() || hostLabel(submission.url);
  const { label, tone } = STATUS_PRESENTATION[submission.status];
  return (
    <li className={ROW}>
      <span aria-hidden="true" className={ICON_BOX}>
        <UploadIcon size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate font-semibold text-[14px] text-text leading-5 tracking-[-0.14px]">
          {title}
        </p>
        <p className="truncate text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          {submissionDetail(submission, topicName)}
        </p>
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-[3px] font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${TONE[tone].badge}`}
      >
        <span aria-hidden="true" className={`size-1.5 rounded-full ${TONE[tone].dot}`} />
        {label}
      </span>
    </li>
  );
}

export function SubmissionsSection({ quiet = false }: { quiet?: boolean }) {
  const { list, reload } = useSubmissions();
  const gate = useSkeletonGate(list.status === "loading");
  const rows = list.status === "ready" ? recentSubmissions(list.rows, PREVIEW) : [];
  if (quiet && list.status !== "error" && rows.length === 0) return null;
  return (
    <ListShell
      id="submissions-heading"
      title="Your submissions"
      tip={SECTION_TIPS.submissions}
      action={
        list.status === "ready" && list.rows.length > 0
          ? { label: "See all submissions", href: ROUTES.app.submit }
          : undefined
      }
    >
      {list.status === "loading" ? (
        <RowSkeleton visible={gate} />
      ) : list.status === "error" ? (
        <LoadError what="your submissions" onRetry={reload} />
      ) : rows.length === 0 ? (
        <Empty
          title="No submissions yet"
          body="Know a great free resource? Share it and a curator will review it."
          link={{ label: "Submit a resource", href: ROUTES.app.submit }}
        />
      ) : (
        <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0 md:grid-cols-2">
          {rows.map((submission) => (
            <SubmissionRow key={submission.id} submission={submission} />
          ))}
        </ul>
      )}
    </ListShell>
  );
}
