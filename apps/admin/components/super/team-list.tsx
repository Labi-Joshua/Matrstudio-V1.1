"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cancelInvite, getInvites, getTeam, resendInvite } from "../../lib/super/api";
import { useLoader, useOnlineStatus, useSkeletonGate } from "../../lib/super/hooks";
import { type Invite, SUPER_ADMIN_ID } from "../../lib/super/types";
import { can, useMe } from "../../lib/super/use-me";
import { PlusIcon, ShieldIcon, UserPlusIcon } from "./icons";
import { InviteModal } from "./invite-modal";
import { useReauth } from "./reauth";
import { InvitesTable, MembersTable, TeamSkeleton } from "./team-tables";
import { useToast } from "./toast";
import { Banner, Button, CARD, EmptyState, ErrorState, PageHeader, Tabs } from "./ui";

type Tab = "members" | "invites";

/**
 * Admin team (Figma SA2.1, SA2.4, SA5.3, loading 673:25154, error 673:26274). Members and Pending
 * invites tabs; invite, resend and revoke need Admin team: Manage (Super admin) and fresh auth.
 */
export function TeamScreen() {
  const toast = useToast();
  const me = useMe();
  const online = useOnlineStatus();
  const team = useLoader(getTeam, []);
  const invites = useLoader(getInvites, []);
  const { run, dialog } = useReauth();
  const [tab, setTab] = useState<Tab>("members");
  const [inviting, setInviting] = useState<{ roleId?: string } | null>(null);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);
  const announce = useRef<HTMLParagraphElement>(null);

  const loading = team.state.status === "loading";
  const showSkeleton = useSkeletonGate(loading);
  const canManage = can(me, "admin_team", "manage");
  const members = team.state.status === "ready" ? team.state.data : [];
  const inviteList = invites.state.status === "ready" ? invites.state.data : [];
  const inviteCount = inviteList.length;

  useEffect(() => {
    if (announce.current && team.state.status === "ready") {
      announce.current.textContent = `${members.length} people on the admin team.`;
    }
  }, [team.state.status, members.length]);

  const reload = useCallback(() => {
    team.reload();
    invites.reload();
  }, [team.reload, invites.reload]);

  const onlySuper =
    canManage &&
    members.filter((m) => m.roleId === SUPER_ADMIN_ID && m.status === "active").length === 1;

  const act = async (invite: Invite, kind: "resend" | "revoke") => {
    setBusyInvite(invite.id);
    const result = await run(() =>
      kind === "resend" ? resendInvite(invite.id) : cancelInvite(invite.id),
    );
    setBusyInvite(null);
    if (result.ok) {
      toast({
        tone: "success",
        title:
          kind === "resend"
            ? `Invite resent to ${invite.email}`
            : `Invite to ${invite.email} revoked`,
        body: kind === "resend" ? "It expires in 72 hours." : "The link no longer works.",
      });
      invites.reload();
    } else {
      toast({
        tone: "error",
        title: kind === "resend" ? "Invite didn’t resend" : "Invite wasn’t revoked",
        body: result.message,
      });
    }
  };

  return (
    <>
      <PageHeader
        title="Admin team"
        subtitle={
          team.state.status === "ready"
            ? `${members.length} ${members.length === 1 ? "person can" : "people can"} sign in to the admin portal. Only Super admins can change roles.`
            : "Only Super admins can change roles."
        }
        actions={
          canManage ? (
            <Button kind="primary" onClick={() => setInviting({})}>
              <UserPlusIcon size={18} />
              Invite admin
            </Button>
          ) : null
        }
      />
      <p ref={announce} className="sr-only" aria-live="polite" />

      {onlySuper ? (
        <Banner
          tone="warning"
          icon={<ShieldIcon size={18} />}
          action={
            <Button
              kind="link"
              className="shrink-0 font-semibold"
              onClick={() => setInviting({ roleId: SUPER_ADMIN_ID })}
            >
              Invite a Super admin
            </Button>
          }
        >
          You’re the only Super admin. Add a second one so the team is never locked out. The last
          Super admin can’t be removed, demoted or suspended.
        </Banner>
      ) : null}

      <Tabs
        label="Admin team"
        value={tab}
        onChange={setTab}
        tabs={[
          {
            value: "members",
            label: "Members",
            count: team.state.status === "ready" ? members.length : undefined,
          },
          {
            value: "invites",
            label: "Pending invites",
            count: invites.state.status === "ready" ? inviteCount : undefined,
          },
        ]}
      />

      {tab === "members" ? (
        team.state.status === "error" ? (
          <div className={CARD}>
            <ErrorState
              offline={!online}
              title={online ? "We couldn’t load the admin team" : "You’re offline"}
              body={
                online
                  ? "Try again in a moment. Nothing was changed."
                  : "Reconnect and try again. Nothing was changed."
              }
              onRetry={team.reload}
            />
          </div>
        ) : loading ? (
          showSkeleton ? (
            <TeamSkeleton />
          ) : null
        ) : members.length === 0 ? (
          <div className={CARD}>
            <EmptyState
              title="No one else is on the team yet"
              body="Invite a teammate to share the work of running the portal."
              action={
                canManage ? (
                  <Button kind="primary" onClick={() => setInviting({})}>
                    <PlusIcon size={18} />
                    Invite admin
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <MembersTable members={members} meId={me?.id ?? null} />
        )
      ) : invites.state.status === "error" ? (
        <div className={CARD}>
          <ErrorState
            offline={!online}
            title="We couldn’t load the pending invites"
            body="Try again in a moment. Nothing was changed."
            onRetry={invites.reload}
          />
        </div>
      ) : invites.state.status === "loading" ? (
        <TeamSkeleton />
      ) : (
        <InvitesTable
          invites={inviteList}
          busyId={busyInvite}
          onResend={canManage ? (i) => act(i, "resend") : undefined}
          onRevoke={canManage ? (i) => act(i, "revoke") : undefined}
        />
      )}

      {inviting ? (
        <InviteModal
          members={members}
          presetRoleId={inviting.roleId}
          reauth={run}
          onClose={() => setInviting(null)}
          onSent={(email) => {
            setInviting(null);
            setTab("invites");
            reload();
            toast({
              tone: "success",
              title: `Invite sent to ${email}`,
              body: "It expires in 72 hours. You can resend or revoke it here.",
            });
          }}
        />
      ) : null}
      {dialog}
    </>
  );
}
