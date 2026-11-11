"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { exportUser, getUser, restoreUser, sendResetLink } from "../../lib/people/api";
import { firstName, formatDate, whenLabel } from "../../lib/people/format";
import { USER_STATUS } from "../../lib/people/logic";
import type { UserDetail } from "../../lib/people/types";
import { useAccess, useLoaded, useNow, useOnline, useSkeletonGate } from "./hooks";
import { failureToast, ToastProvider, useToast } from "./toast";
import {
  Avatar,
  BAR,
  BackLink,
  Badge,
  BTN_DANGER_OUTLINE,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  Facts,
  FOCUS,
  LoadError,
  Notice,
  OfflineNote,
  PATHS,
  PageHeader,
  StateBlock,
} from "./ui";
import { DeleteModal, SuspendModal } from "./user-modals";

export function UserDetailPage() {
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <Inner />
      </Suspense>
    </ToastProvider>
  );
}

const PATH_STATE = {
  in_progress: ["In progress", "neutral"],
  completed: ["Completed", "success"],
  saved: ["Saved", "neutral"],
} as const;
const SUB_STATE = {
  approved: ["Approved", "success"],
  in_review: ["In review", "warning"],
  declined: ["Declined", "error"],
  needs_changes: ["Needs changes", "warning"],
} as const;

function Inner() {
  const id = useSearchParams().get("id") ?? "";
  const { state, reload } = useLoaded((s) => getUser(id, s), id);
  const gate = useSkeletonGate(state.status === "loading");
  const online = useOnline();
  const loaded = state.status === "ready" ? state.data : null;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/users">Users</BackLink>
      {online ? null : <OfflineNote />}
      {!id || (state.status === "error" && state.failure.code === "not_found") ? (
        <StateBlock
          role="status"
          title="We can’t find that person"
          body="They may have been deleted. Go back to the list and search again."
        >
          <Link href="/users" className={BTN_SECONDARY}>
            Back to users
          </Link>
        </StateBlock>
      ) : state.status === "error" ? (
        <LoadError what="this person" onRetry={reload} />
      ) : loaded ? (
        <Detail user={loaded} reload={reload} />
      ) : (
        <div role="status" aria-busy="true">
          <p className="sr-only">Loading this person</p>
          {gate ? <DetailSkeleton /> : null}
        </div>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className={`${BAR} h-9 w-56`} />
        <div className={`${BAR} h-4 w-72`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className={`${BAR} h-72 rounded-2xl`} />
        <div className={`${BAR} h-72 rounded-2xl`} />
      </div>
    </div>
  );
}

function Detail({ user, reload }: { user: UserDetail; reload: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const access = useAccess();
  const now = useNow();
  const online = useOnline();
  const [modal, setModal] = useState<"suspend" | "delete" | null>(null);
  const [busy, setBusy] = useState<"reset" | "restore" | "export" | null>(null);
  const canManage = access?.users === "manage";
  const status = USER_STATUS[user.status];
  const suspended = user.status === "suspended";
  const name = firstName(user.name);

  async function act(kind: "reset" | "restore" | "export") {
    setBusy(kind);
    if (kind === "export") {
      const r = await exportUser(user.id);
      setBusy(null);
      if (!r.ok) return toast(failureToast("Couldn’t export the data", r.message));
      if (r.data.data !== null) {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(r.data.data, null, 2)], { type: "application/json" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `matr-data-${user.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return toast({
          tone: "success",
          title: "Data downloaded",
          body: `A copy of ${name}’s data was saved to your device.`,
        });
      }
      return toast({
        tone: "success",
        title: "Export requested",
        body: r.data.queued ? `${name} gets the copy by email.` : "It is being prepared.",
      });
    }
    const r = await (kind === "reset" ? sendResetLink(user.id) : restoreUser(user.id));
    setBusy(null);
    if (!r.ok)
      return toast(
        failureToast(
          kind === "reset" ? "Reset link didn’t send" : "Couldn’t restore access",
          r.message,
        ),
      );
    toast(
      kind === "reset"
        ? {
            tone: "success",
            title: "Reset link sent",
            body: `${name} gets an email with a link to choose a new password.`,
          }
        : { tone: "success", title: "Access restored", body: `${name} can sign in again.` },
    );
    if (kind === "restore") reload();
  }

  return (
    <>
      <PageHeader
        title={user.name}
        badge={<Badge tone={status.tone}>{status.label}</Badge>}
        intro={`${user.email} · joined ${formatDate(user.joinedAt)}`}
        aside={
          canManage ? (
            <>
              <button
                type="button"
                disabled={busy !== null || !online}
                onClick={() => act("reset")}
                className={BTN_SECONDARY}
              >
                {busy === "reset" ? "Sending…" : "Send reset link"}
              </button>
              {suspended ? (
                <button
                  type="button"
                  disabled={busy !== null || !online}
                  onClick={() => act("restore")}
                  className={BTN_PRIMARY}
                >
                  {busy === "restore" ? "Restoring…" : "Restore access"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => setModal("suspend")}
                  className={BTN_DANGER_OUTLINE}
                >
                  Suspend
                </button>
              )}
            </>
          ) : null
        }
      />
      {user.suspension ? (
        <Notice tone="error" icon={PATHS.lock}>
          Suspended {whenLabel(user.suspension.at, now).toLowerCase()} by {user.suspension.by}
          {user.suspension.reason ? ` · Reason: ${user.suspension.reason}` : ""}. They can’t sign in
          and were emailed the reason.
        </Notice>
      ) : null}
      {user.profileHidden ? (
        <Notice tone="warning" icon={PATHS.shield}>
          Public profile hidden on {formatDate(user.profileHidden.at)}
          {user.profileHidden.reason ? ` for ${user.profileHidden.reason}` : ""}
          {user.profileHidden.reports > 0 ? ` (${user.profileHidden.reports} reports)` : ""}.
        </Notice>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <Section
            title="Paths and progress"
            empty="No paths started yet."
            count={user.paths.length}
          >
            {user.paths.map((p) => {
              const [label, tone] = PATH_STATE[p.state];
              const sub =
                p.state === "in_progress"
                  ? `Lesson ${p.lessonsDone} of ${p.lessonsTotal} · ${p.percent}%`
                  : p.state === "completed"
                    ? `Finished ${formatDate(p.finishedAt)}`
                    : "Starred · not started";
              return (
                <Row
                  key={p.id}
                  title={p.title}
                  sub={sub}
                  badge={<Badge tone={tone}>{label}</Badge>}
                />
              );
            })}
          </Section>
          <Section title="Submissions" empty="No submissions." count={user.submissions.length}>
            {user.submissions.map((s) => {
              const [label, tone] = SUB_STATE[s.status];
              return (
                <Row
                  key={s.id}
                  title={s.title}
                  sub={
                    s.status === "in_review"
                      ? "Waiting for review"
                      : `${label} · ${formatDate(s.at)}`
                  }
                  badge={<Badge tone={tone}>{label}</Badge>}
                />
              );
            })}
          </Section>
          <Section
            title="Help requests"
            empty="No help requests."
            count={user.tickets.length}
            link={{ href: "/support", label: "Open in Support inbox" }}
          >
            {user.tickets.map((t) => {
              const closed = ["resolved", "fixed", "cant_reproduce"].includes(t.status);
              return (
                <Row
                  key={t.id}
                  href={`/support?id=${encodeURIComponent(t.id)}`}
                  title={t.subject}
                  sub={`${t.kind === "report" ? "Report a problem" : "Contact support"} · ${whenLabel(t.at, now)}`}
                  badge={
                    <Badge tone={closed ? "success" : "warning"}>
                      {closed ? "Resolved" : "Open"}
                    </Badge>
                  }
                />
              );
            })}
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <section aria-labelledby="acct" className={`${CARD} flex flex-col gap-4 p-5`}>
            <h2 id="acct" className="font-medium text-[15px] text-text">
              Account
            </h2>
            <div className="flex items-center gap-3">
              <Avatar name={user.name} size={40} />
              <div className="min-w-0 text-[14px] leading-5">
                <p className="truncate text-text">{user.name}</p>
                <p className="truncate text-[13px] text-text-tertiary">{user.email}</p>
              </div>
            </div>
            <Facts
              rows={[
                ["Status", status.label],
                [
                  "Email",
                  user.emailConfirmedAt
                    ? `Confirmed ${formatDate(user.emailConfirmedAt)}`
                    : "Not confirmed",
                ],
                [
                  "Signs in with",
                  { password: "Email and password", google: "Google", both: "Email and Google" }[
                    user.authMethod
                  ],
                ],
                ["Last sign-in", user.lastSignInAt ? whenLabel(user.lastSignInAt, now) : "Never"],
              ]}
            />
            <p className="text-[12px] text-text-tertiary leading-4">
              Passwords are never shown. Send a reset link instead.
            </p>
          </section>
          <section aria-labelledby="data" className={`${CARD} flex flex-col gap-3 p-5`}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="data" className="font-medium text-[15px] text-text">
                Data and deletion
              </h2>
              <span className="rounded border border-border px-1.5 text-[11px] text-text-secondary">
                Super admin only
              </span>
            </div>
            <p className="text-[13px] text-text-tertiary leading-5">
              Use these when the person asks for a copy of their data or to delete their account.
            </p>
            {canManage ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy !== null || !online}
                  onClick={() => act("export")}
                  className={BTN_SECONDARY}
                >
                  {busy === "export" ? "Requesting…" : "Export data"}
                </button>
                {access?.superAdmin ? (
                  <button
                    type="button"
                    disabled={!online}
                    onClick={() => setModal("delete")}
                    className={BTN_DANGER_OUTLINE}
                  >
                    Delete account
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] text-text-secondary">
                You can view accounts but not change them.
              </p>
            )}
            {canManage && !access?.superAdmin ? (
              <p className="text-[12px] text-text-tertiary">
                Deleting an account is for Super admins.
              </p>
            ) : null}
          </section>
        </div>
      </div>

      {modal === "suspend" ? (
        <SuspendModal user={user} onClose={() => setModal(null)} onDone={reload} />
      ) : null}
      {modal === "delete" ? (
        <DeleteModal
          user={user}
          onClose={() => setModal(null)}
          onDeleted={() => router.replace("/users")}
        />
      ) : null}
    </>
  );
}

function Section({
  title,
  count,
  empty,
  link,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className={`${CARD} flex flex-col gap-3 p-5`} aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-[15px] text-text">{title}</h2>
        {link && count > 0 ? (
          <Link href={link.href} className={`rounded text-[14px] text-primary-text ${FOCUS}`}>
            {link.label}
          </Link>
        ) : null}
      </div>
      {count === 0 ? (
        <p className="text-[14px] text-text-tertiary">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">{children}</ul>
      )}
    </section>
  );
}

function Row({
  title,
  sub,
  badge,
  href,
}: {
  title: string;
  sub: string;
  badge: React.ReactNode;
  href?: string;
}) {
  return (
    <li className="relative flex items-center justify-between gap-3 rounded-xl bg-bg-fill1 px-4 py-3">
      <div className="min-w-0 text-[14px] leading-5 tracking-[-0.14px]">
        {href ? (
          <Link
            href={href}
            className={`truncate rounded text-text after:absolute after:inset-0 ${FOCUS}`}
          >
            {title}
          </Link>
        ) : (
          <p className="truncate text-text">{title}</p>
        )}
        <p className="truncate text-[13px] text-text-tertiary">{sub}</p>
      </div>
      {badge}
    </li>
  );
}
