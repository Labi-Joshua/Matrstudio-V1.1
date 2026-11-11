"use client";

import { cn } from "@matr/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { getMember, getTeam, restoreMember, unlockMember } from "../../lib/super/api";
import { dayMonth, whenLabel } from "../../lib/super/format";
import { useLoader, useOnlineStatus, useSkeletonGate } from "../../lib/super/hooks";
import { SUPER_ADMIN_ID } from "../../lib/super/types";
import { can, useMe } from "../../lib/super/use-me";
import { ArrowLeftIcon, KeyIcon, LockIcon, LogOutIcon, ShieldIcon } from "./icons";
import {
  ChangeRoleModal,
  type ModalProps,
  RemoveModal,
  SignOutModal,
  SuspendModal,
  TemporaryAccessModal,
} from "./member-modals";
import { useReauth } from "./reauth";
import { accessOf } from "./team-tables";
import { useToast } from "./toast";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  CARD,
  EmptyState,
  ErrorState,
  FOCUS,
  PageHeader,
  roleTone,
  Skeleton,
} from "./ui";

type ModalKind = "role" | "temp" | "suspend" | "remove" | "signout";

const BackLink = () => (
  <Link
    href="/team"
    className={cn(
      "inline-flex w-fit items-center gap-1 rounded-md font-medium text-[14px] text-text-secondary leading-5 hover:text-text",
      FOCUS,
    )}
  >
    <ArrowLeftIcon size={18} />
    Admin team
  </Link>
);

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-3 text-[14px] leading-5 sm:grid-cols-[130px_1fr]">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-text">{children}</dd>
    </div>
  );
}

/**
 * Member detail (Figma SA3.1 to SA3.8) at /team/detail?id=. Role and access, security, danger
 * zone, and the six modals. Own account: role, suspend and remove are disabled with the banner.
 * The last Super admin can't be demoted, suspended or removed (disabled here, enforced by the API).
 */
export function MemberDetailScreen() {
  const id = useSearchParams().get("id") ?? "";
  const toast = useToast();
  const me = useMe();
  const online = useOnlineStatus();
  const detail = useLoader(() => getMember(id), [id]);
  const team = useLoader(getTeam, []);
  const { run, dialog } = useReauth();
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState<string | null>(null);

  const showSkeleton = useSkeletonGate(detail.state.status === "loading");
  const canManage = can(me, "admin_team", "manage");

  if (!id) {
    return (
      <>
        <BackLink />
        <div className={CARD}>
          <EmptyState title="No admin picked" body="Open someone from the Admin team list." />
        </div>
      </>
    );
  }
  if (removed) {
    return (
      <>
        <BackLink />
        <div className={CARD}>
          <EmptyState
            title={`${removed} was removed from the admin team`}
            body="They’re signed out everywhere and their work stays, credited as “Former admin”."
            action={
              <Link
                href="/team"
                className={cn(
                  "inline-flex h-10 items-center rounded-lg bg-ink px-3.5 font-medium text-[14px] text-bg-base",
                  FOCUS,
                )}
              >
                Back to the admin team
              </Link>
            }
          />
        </div>
      </>
    );
  }
  if (detail.state.status === "error") {
    const gone = detail.state.code === "not_found";
    return (
      <>
        <BackLink />
        <div className={CARD}>
          {gone ? (
            <EmptyState
              title="That admin isn’t on the team"
              body="They may have been removed. Check the Admin team list."
            />
          ) : (
            <ErrorState
              offline={!online}
              title={online ? "We couldn’t load this admin" : "You’re offline"}
              body="Try again in a moment. Nothing was changed."
              onRetry={detail.reload}
            />
          )}
        </div>
      </>
    );
  }
  if (detail.state.status === "loading") {
    return (
      <>
        <BackLink />
        {showSkeleton ? <DetailSkeleton /> : null}
      </>
    );
  }

  const member = detail.state.data;
  const isSelf = me?.id === member.id;
  const supers =
    team.state.status === "ready"
      ? team.state.data.filter((m) => m.roleId === SUPER_ADMIN_ID && m.status === "active")
      : [];
  const lastSuper = member.roleId === SUPER_ADMIN_ID && supers.length <= 1 && supers.length > 0;
  const access = accessOf(member);
  const suspended = member.status === "suspended";
  const noChange = isSelf || lastSuper;

  const done: ModalProps["onDone"] = (title, body) => {
    const wasRemove = modal === "remove";
    setModal(null);
    if (wasRemove) {
      setRemoved(member.name);
      return;
    }
    toast({ tone: "success", title, body });
    detail.reload();
    team.reload();
  };

  const quick = async (action: () => ReturnType<typeof restoreMember>, title: string) => {
    setBusy(true);
    const result = await run(action);
    setBusy(false);
    if (result.ok) {
      toast({ tone: "success", title });
      detail.reload();
      team.reload();
    } else {
      toast({ tone: "error", title: "That didn’t work", body: result.message });
    }
  };

  const modalProps: ModalProps = {
    member,
    reauth: run,
    onClose: () => setModal(null),
    onDone: done,
  };
  const sessionsText =
    member.sessions.length > 0
      ? `${member.sessions.length} · ${member.sessions.map((s) => s.device).join(", ")}`
      : String(member.sessionCount);
  const lastSignIn =
    member.lastSignInAt === null
      ? "Never"
      : [whenLabel(member.lastSignInAt), member.lastSignInPlace].filter(Boolean).join(" · ");

  return (
    <>
      <BackLink />
      <div className="flex items-start gap-4">
        <Avatar name={member.name} size={56} />
        <div className="min-w-0 flex-1">
          <PageHeader
            title={isSelf ? `${member.name} (you)` : member.name}
            subtitle={member.email}
            badge={
              <span className="flex flex-wrap gap-1.5">
                <Badge tone={roleTone(member.roleId)}>{member.roleName}</Badge>
                <Badge tone={suspended ? "red" : member.locked ? "amber" : "green"}>
                  {suspended ? "Suspended" : member.locked ? "Sign-in paused" : "Active"}
                </Badge>
              </span>
            }
            actions={
              canManage ? (
                <Button
                  kind="primary"
                  disabled={noChange}
                  title={
                    isSelf
                      ? "You can’t change your own role"
                      : lastSuper
                        ? "The last Super admin can’t be demoted"
                        : undefined
                  }
                  onClick={() => setModal("role")}
                >
                  <KeyIcon size={18} />
                  Change role
                </Button>
              ) : null
            }
          />
        </div>
      </div>

      {isSelf ? (
        <Banner icon={<ShieldIcon size={18} />}>
          You can’t change your own role or remove yourself. Ask another Super admin.
        </Banner>
      ) : lastSuper && canManage ? (
        <Banner tone="warning" icon={<ShieldIcon size={18} />}>
          This is the only Super admin. The last Super admin can’t be removed, demoted or suspended.
        </Banner>
      ) : null}
      {member.locked && canManage ? (
        <Banner
          tone="warning"
          icon={<LockIcon size={18} />}
          action={
            <Button
              className="shrink-0"
              disabled={busy}
              onClick={() => quick(() => unlockMember(member.id), "Sign-in unlocked")}
            >
              Unlock
            </Button>
          }
        >
          Sign-in is paused after too many wrong tries. Unlock it so {member.name} can try again.
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="role-access" className={cn(CARD, "flex flex-col gap-4 p-5")}>
          <h2 id="role-access" className="font-medium text-[14px] text-text leading-5">
            Role and access
          </h2>
          <dl className="flex flex-col gap-3.5">
            <Row label="Role">
              <Badge tone={roleTone(member.roleId)}>{member.roleName}</Badge>
            </Row>
            <Row label="Access">
              {member.accessExpiresAt !== null
                ? `Until ${dayMonth(member.accessExpiresAt, Date.now(), true)}`
                : suspended
                  ? access.text
                  : "Permanent"}
              {canManage && !suspended && !isSelf ? (
                <Button kind="link" onClick={() => setModal("temp")}>
                  {member.accessExpiresAt !== null ? "Change end date" : "Make temporary"}
                </Button>
              ) : null}
            </Row>
            <Row label="Invited by">{member.invitedBy || "Founding Super admin"}</Row>
            <Row label="Joined">
              {member.joinedAt ? dayMonth(member.joinedAt, Date.now(), true) : "Not yet"}
            </Row>
          </dl>
        </section>
        <section aria-labelledby="security" className={cn(CARD, "flex flex-col gap-4 p-5")}>
          <h2 id="security" className="font-medium text-[14px] text-text leading-5">
            Security
          </h2>
          <dl className="flex flex-col gap-3.5">
            <Row label="2-step code">
              <Badge tone={member.twoStep ? "green" : "amber"}>
                {member.twoStep ? "On" : "Not set up"}
              </Badge>
              {member.twoStepSetUpAt ? (
                <span className="text-text-secondary">
                  Set up {dayMonth(member.twoStepSetUpAt)}
                </span>
              ) : null}
            </Row>
            <Row label="Active sessions">{sessionsText}</Row>
            <Row label="Last sign-in">{lastSignIn}</Row>
          </dl>
          {canManage ? (
            <Button kind="link" className="w-fit" onClick={() => setModal("signout")}>
              <LogOutIcon size={16} />
              Sign out everywhere
            </Button>
          ) : null}
        </section>
      </div>

      {canManage ? (
        <section
          aria-labelledby="danger"
          className={cn(
            CARD,
            "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <div>
            <h2 id="danger" className="font-medium text-[14px] text-text leading-5">
              Danger zone
            </h2>
            <p className="text-[13px] text-text-secondary leading-[18px]">
              Suspend blocks sign-in but keeps their role. Removing access signs them out
              everywhere; their work stays.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {suspended ? (
              <Button
                disabled={busy}
                onClick={() => quick(() => restoreMember(member.id), `${member.name} is restored`)}
              >
                Restore access
              </Button>
            ) : (
              <Button
                kind="danger-outline"
                disabled={noChange}
                title={noChange ? "Not available for this account" : undefined}
                onClick={() => setModal("suspend")}
              >
                Suspend access
              </Button>
            )}
            <Button
              kind="danger"
              disabled={noChange}
              title={noChange ? "Not available for this account" : undefined}
              onClick={() => setModal("remove")}
            >
              Remove access
            </Button>
          </div>
        </section>
      ) : null}

      {modal === "role" ? <ChangeRoleModal {...modalProps} /> : null}
      {modal === "temp" ? <TemporaryAccessModal {...modalProps} /> : null}
      {modal === "suspend" ? <SuspendModal {...modalProps} /> : null}
      {modal === "remove" ? <RemoveModal {...modalProps} /> : null}
      {modal === "signout" ? <SignOutModal {...modalProps} /> : null}
      {dialog}
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-60" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
      <Skeleton className="h-20 rounded-2xl" />
    </div>
  );
}
