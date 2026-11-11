import Link from "next/link";
import type { ReactNode } from "react";
import { initialsOf, plural, waitingLabel } from "../../lib/review/format";
import { labelOf, TYPE_OPTIONS } from "../../lib/review/options";
import type {
  Assignee,
  LinkReportRow,
  ProfileReportRow,
  SubmissionRow,
} from "../../lib/review/types";
import { Avatar, Badge, FOCUS, Skeleton } from "./ui";

const TH = "px-4 py-3 text-left font-normal text-[13px] text-text-tertiary";
const TD = "px-4 py-3 align-middle text-[13px] text-text";

function Shell({ label, head, children }: { label: string; head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-soft">
      <table className="w-full border-collapse">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-bg-fill1">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-border-soft">{children}</tbody>
      </table>
    </div>
  );
}

const assignedLabel = (a: Assignee, meId: string | null) =>
  a ? (a.id === meId ? "You" : a.name) : "—";

function OpenLink({ href, name, label }: { href: string; name: string; label: string }) {
  return (
    <Link href={href} className={`rounded-md font-medium text-text hover:underline ${FOCUS}`}>
      {label}
      <span className="sr-only"> {name}</span>
    </Link>
  );
}

const Sub = ({ children }: { children: ReactNode }) => (
  <span className="block text-[12px] text-text-tertiary">{children}</span>
);

export const submissionHref = (id: string) => `/review/submission?id=${encodeURIComponent(id)}`;
export const linkReportHref = (id: string) => `/review/link-report?id=${encodeURIComponent(id)}`;
export const profileReportHref = (id: string) =>
  `/review/profile-report?id=${encodeURIComponent(id)}`;

export function SubmissionsTable({ rows, meId }: { rows: SubmissionRow[]; meId: string | null }) {
  return (
    <Shell
      label="Submissions waiting for review, oldest first"
      head={
        <>
          <th className={TH}>Resource</th>
          <th className={`${TH} hidden md:table-cell`}>Submitted by</th>
          <th className={`${TH} hidden lg:table-cell`}>Type</th>
          <th className={`${TH} hidden md:table-cell`}>Auto-check</th>
          <th className={TH}>Waiting</th>
          <th className={`${TH} hidden lg:table-cell`}>Assigned</th>
          <th className={TH}>
            <span className="sr-only">Open</span>
          </th>
        </>
      }
    >
      {rows.map((r) => (
        <tr key={r.id} className="hover:bg-bg-fill1">
          <td className={TD}>
            <Link href={submissionHref(r.id)} className={`rounded-md hover:underline ${FOCUS}`}>
              {r.title}
            </Link>
            <Sub>{r.source}</Sub>
          </td>
          <td className={`${TD} hidden md:table-cell`}>
            <span className="flex items-center gap-2.5">
              <Avatar name={r.submitter.name} size={28} />
              <span className="min-w-0">
                {r.submitter.name}
                <Sub>
                  {r.submitter.submitted} submitted
                  {r.submitter.approved > 0 ? ` · ${r.submitter.approved} approved` : ""}
                </Sub>
              </span>
            </span>
          </td>
          <td className={`${TD} hidden lg:table-cell`}>
            <Badge>{labelOf(TYPE_OPTIONS, r.type)}</Badge>
          </td>
          <td className={`${TD} hidden md:table-cell`}>
            <Badge
              tone={
                r.check.status === "pass"
                  ? "success"
                  : r.check.status === "warn"
                    ? "warning"
                    : "error"
              }
              icon={r.check.status === "pass" ? "check" : "alert"}
            >
              {r.check.label}
            </Badge>
          </td>
          <td className={`${TD} whitespace-nowrap`}>{waitingLabel(r.ageDays)}</td>
          <td className={`${TD} hidden lg:table-cell`}>{assignedLabel(r.assignedTo, meId)}</td>
          <td className={`${TD} text-right`}>
            <OpenLink href={submissionHref(r.id)} name={r.title} label="Review" />
          </td>
        </tr>
      ))}
    </Shell>
  );
}

const LINK_TONE = { failed: "error", redirects: "warning", ok: "success" } as const;
const LINK_LABEL = { failed: "Failed", redirects: "Redirects", ok: "OK" } as const;

export function LinkReportsTable({ rows, meId }: { rows: LinkReportRow[]; meId: string | null }) {
  return (
    <Shell
      label="Reported links, oldest first"
      head={
        <>
          <th className={TH}>Resource</th>
          <th className={`${TH} hidden md:table-cell`}>Reported by</th>
          <th className={`${TH} hidden lg:table-cell`}>Reason</th>
          <th className={`${TH} hidden md:table-cell`}>Link check</th>
          <th className={TH}>Waiting</th>
          <th className={`${TH} hidden lg:table-cell`}>Assigned</th>
          <th className={TH}>
            <span className="sr-only">Open</span>
          </th>
        </>
      }
    >
      {rows.map((r) => (
        <tr key={r.id} className="hover:bg-bg-fill1">
          <td className={TD}>
            <Link href={linkReportHref(r.id)} className={`rounded-md hover:underline ${FOCUS}`}>
              {r.title}
            </Link>
            <Sub>
              {r.source}
              {r.source ? " · " : ""}
              {r.usedInPaths > 0 ? `used in ${plural(r.usedInPaths, "path")}` : "library only"}
            </Sub>
          </td>
          <td className={`${TD} hidden md:table-cell`}>{plural(r.reportCount, "learner")}</td>
          <td className={`${TD} hidden lg:table-cell`}>{r.reason}</td>
          <td className={`${TD} hidden md:table-cell`}>
            <Badge tone={LINK_TONE[r.linkStatus]} icon={r.linkStatus === "ok" ? "check" : "alert"}>
              {LINK_LABEL[r.linkStatus]}
            </Badge>
          </td>
          <td className={`${TD} whitespace-nowrap`}>{waitingLabel(r.ageDays)}</td>
          <td className={`${TD} hidden lg:table-cell`}>{assignedLabel(r.assignedTo, meId)}</td>
          <td className={`${TD} text-right`}>
            <OpenLink href={linkReportHref(r.id)} name={r.title} label="Open" />
          </td>
        </tr>
      ))}
    </Shell>
  );
}

export function ProfileReportsTable({
  rows,
  meId,
}: {
  rows: ProfileReportRow[];
  meId: string | null;
}) {
  return (
    <Shell
      label="Reported profiles, oldest first"
      head={
        <>
          <th className={TH}>Profile</th>
          <th className={`${TH} hidden md:table-cell`}>Reason</th>
          <th className={`${TH} hidden md:table-cell`}>Reports</th>
          <th className={TH}>Waiting</th>
          <th className={`${TH} hidden lg:table-cell`}>Assigned</th>
          <th className={TH}>
            <span className="sr-only">Open</span>
          </th>
        </>
      }
    >
      {rows.map((r) => (
        <tr key={r.id} className="hover:bg-bg-fill1">
          <td className={TD}>
            <span className="flex items-center gap-2.5">
              <Avatar name={r.name || initialsOf(r.handle)} url={r.avatarUrl} size={32} />
              <span className="min-w-0">
                <Link
                  href={profileReportHref(r.id)}
                  className={`rounded-md hover:underline ${FOCUS}`}
                >
                  {r.name}
                </Link>
                <Sub>{r.handle ? `@${r.handle.replace(/^@/, "")}` : ""}</Sub>
              </span>
            </span>
          </td>
          <td className={`${TD} hidden md:table-cell`}>
            <Badge tone="primary" icon="alert">
              {r.reason}
            </Badge>
          </td>
          <td className={`${TD} hidden md:table-cell`}>{r.reportCount}</td>
          <td className={`${TD} whitespace-nowrap`}>{waitingLabel(r.ageDays)}</td>
          <td className={`${TD} hidden lg:table-cell`}>{assignedLabel(r.assignedTo, meId)}</td>
          <td className={`${TD} text-right`}>
            <OpenLink href={profileReportHref(r.id)} name={r.name} label="Open" />
          </td>
        </tr>
      ))}
    </Shell>
  );
}

export function TableSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the queue"
      className="overflow-hidden rounded-2xl border border-border-soft"
    >
      <div className="h-11 bg-bg-fill1" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 border-border-soft border-t px-4 py-3.5">
          <div className="flex-1">
            <Skeleton className="h-3.5 w-48 max-w-full" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
          <Skeleton className="hidden size-7 rounded-full md:block" />
          <Skeleton className="hidden h-3.5 w-28 md:block" />
          <Skeleton className="h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}
