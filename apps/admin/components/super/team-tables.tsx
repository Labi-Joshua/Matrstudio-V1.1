"use client";

import { cn } from "@matr/ui";
import Link from "next/link";
import { useState } from "react";
import { agoLabel, dayMonth, expiresLabel, whenLabel } from "../../lib/super/format";
import type { Invite, Member } from "../../lib/super/types";
import {
  Avatar,
  Badge,
  Button,
  CARD,
  EmptyState,
  FOCUS,
  roleTone,
  Skeleton,
  StatusDot,
} from "./ui";

const MEMBER_GRID =
  "md:grid md:grid-cols-[minmax(0,2.2fr)_1fr_1.1fr_1fr_0.6fr_0.7fr] md:items-center";
const INVITE_GRID = "md:grid md:grid-cols-[minmax(0,2.2fr)_1fr_1.2fr_1fr_1.2fr] md:items-center";

export const detailHref = (id: string) => `/team/detail?id=${encodeURIComponent(id)}`;

function Header({ labels, grid }: { labels: string[]; grid: string }) {
  return (
    <div
      className={cn(
        "hidden h-10 border-border-soft border-b bg-bg-fill1 px-4 font-medium text-[14px] text-text-secondary tracking-[-0.14px]",
        grid,
      )}
    >
      {labels.map((label) => (
        <span key={label || "actions"}>{label}</span>
      ))}
    </div>
  );
}

export function accessOf(member: Member, now = Date.now()) {
  if (member.locked) return { text: "Sign-in paused", tone: "amber" as const };
  if (member.status === "suspended") return { text: "Suspended", tone: "red" as const };
  if (member.status === "invited") return { text: "Invited", tone: "grey" as const };
  if (member.accessExpiresAt !== null) {
    return { text: `Until ${dayMonth(member.accessExpiresAt, now)}`, tone: "amber" as const };
  }
  return { text: "Active", tone: "green" as const };
}

export function MembersTable({ members, meId }: { members: Member[]; meId: string | null }) {
  return (
    <div className={cn(CARD, "overflow-hidden")}>
      <Header
        labels={["Member", "Role", "Access", "Last active", "2-step", ""]}
        grid={MEMBER_GRID}
      />
      <ul>
        {members.map((m) => {
          const access = accessOf(m);
          return (
            <li
              key={m.id}
              className={cn(
                "flex flex-col gap-2 border-border-soft border-b px-4 py-3 last:border-b-0",
                MEMBER_GRID,
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={m.name} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-[14px] text-text leading-5">
                    {m.name}
                    {m.id === meId ? " (you)" : ""}
                  </p>
                  <p className="truncate text-[12px] text-text-tertiary leading-4">{m.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-12 md:contents md:pl-0">
                <span className="md:block">
                  <Badge tone={roleTone(m.roleId)}>{m.roleName}</Badge>
                </span>
                <span className="inline-flex items-center gap-2 text-[14px] text-text leading-5">
                  <StatusDot tone={access.tone} />
                  {access.text}
                </span>
                <span className="text-[14px] text-text-secondary leading-5">
                  <span className="md:hidden">Last active </span>
                  {agoLabel(m.lastSignInAt)}
                </span>
                <span className="text-[14px] text-text-secondary leading-5">
                  <span className="md:hidden">2-step </span>
                  {m.twoStep ? "On" : "Not set up"}
                </span>
                <Link
                  href={detailHref(m.id)}
                  aria-label={`Manage ${m.name}`}
                  className={cn(
                    "ml-auto rounded-md font-medium text-[14px] text-text hover:underline md:ml-0",
                    FOCUS,
                  )}
                >
                  Manage
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function InvitesTable({
  invites,
  onResend,
  onRevoke,
  busyId,
}: {
  invites: Invite[];
  /** Omitted for viewers without Admin team: Manage; the buttons are then hidden. */
  onResend?: (invite: Invite) => void;
  onRevoke?: (invite: Invite) => void;
  busyId: string | null;
}) {
  const [now] = useState(() => Date.now());
  if (invites.length === 0) {
    return (
      <div className={CARD}>
        <EmptyState
          title="No pending invites"
          body="Invites you send show up here until the person joins or the 72 hours run out."
        />
      </div>
    );
  }
  return (
    <div className={cn(CARD, "overflow-hidden")}>
      <Header labels={["Invitee", "Role", "Invite", "Sent", ""]} grid={INVITE_GRID} />
      <ul>
        {invites.map((invite) => {
          const label = expiresLabel(invite.expiresAt, now);
          const expired = label === "Expired";
          const busy = busyId === invite.id;
          return (
            <li
              key={invite.id}
              className={cn(
                "flex flex-col gap-2 border-border-soft border-b px-4 py-3 last:border-b-0",
                INVITE_GRID,
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={invite.name || invite.email} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-[14px] text-text leading-5">
                    {invite.name || invite.email}
                  </p>
                  {invite.name ? (
                    <p className="truncate text-[12px] text-text-tertiary leading-4">
                      {invite.email}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-12 md:contents md:pl-0">
                <span>
                  <Badge tone={roleTone(invite.roleId)}>{invite.roleName}</Badge>
                </span>
                <span className="inline-flex items-center gap-2 text-[14px] text-text leading-5">
                  <StatusDot tone={expired ? "red" : "amber"} />
                  {label}
                </span>
                <span className="text-[14px] text-text-secondary leading-5">
                  {whenLabel(invite.createdAt, now)}
                </span>
                <span
                  className={cn("ml-auto flex items-center gap-4 md:ml-0", !onResend && "hidden")}
                >
                  <Button
                    kind="link"
                    className="text-text"
                    disabled={busy}
                    onClick={() => onResend?.(invite)}
                    aria-label={`Resend invite to ${invite.email}`}
                  >
                    Resend
                  </Button>
                  <Button
                    kind="link-danger"
                    disabled={busy}
                    onClick={() => onRevoke?.(invite)}
                    aria-label={`Revoke invite to ${invite.email}`}
                  >
                    Revoke
                  </Button>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TeamSkeleton() {
  return (
    <div className={cn(CARD, "overflow-hidden")} aria-hidden="true">
      <div className="hidden h-10 border-border-soft border-b bg-bg-fill1 md:block" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-border-soft border-b px-4 py-3.5 last:border-b-0"
        >
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </div>
          <Skeleton className="hidden h-5 w-20 md:block" />
          <Skeleton className="hidden h-4 w-24 md:block" />
        </div>
      ))}
    </div>
  );
}
