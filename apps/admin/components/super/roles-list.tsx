"use client";

import { cn } from "@matr/ui";
import Link from "next/link";
import { getRoles } from "../../lib/super/api";
import { dayMonth } from "../../lib/super/format";
import { useLoader, useOnlineStatus, useSkeletonGate } from "../../lib/super/hooks";
import { accessSummary } from "../../lib/super/matrix";
import { can, useMe } from "../../lib/super/use-me";
import { PlusIcon } from "./icons";
import { Badge, CARD, ErrorState, FOCUS, PageHeader, Skeleton } from "./ui";

const GRID = "md:grid md:grid-cols-[minmax(0,2.4fr)_1fr_0.7fr_1.3fr_0.6fr] md:items-center";

/** Roles and permissions list (Figma SA4.1, loading 673:28085). */
export function RolesScreen() {
  const me = useMe();
  const online = useOnlineStatus();
  const roles = useLoader(getRoles, []);
  const showSkeleton = useSkeletonGate(roles.state.status === "loading");
  const canManage = can(me, "roles", "manage");
  const ready = roles.state.status === "ready" ? roles.state.data : null;
  const custom = ready ? ready.roles.filter((r) => !r.builtIn).length : 0;
  const limit = ready?.customLimit ?? 20;
  const full = custom >= limit;

  return (
    <>
      <PageHeader
        title="Roles and permissions"
        subtitle={
          ready
            ? `Built-in roles are locked. Create custom roles for anything in between. ${custom} of ${limit} custom roles used.`
            : "Built-in roles are locked. Create custom roles for anything in between."
        }
        actions={
          canManage ? (
            full ? (
              <span className="text-[13px] text-text-tertiary">
                All {limit} custom roles are used.
              </span>
            ) : (
              <Link
                href="/roles/new"
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-lg bg-ink px-3.5 font-medium text-[14px] text-bg-base",
                  FOCUS,
                )}
              >
                <PlusIcon size={18} />
                Create role
              </Link>
            )
          ) : null
        }
      />
      {roles.state.status === "error" ? (
        <div className={CARD}>
          <ErrorState
            offline={!online}
            title={online ? "We couldn’t load the roles" : "You’re offline"}
            body="Try again in a moment. Nothing was changed."
            onRetry={roles.reload}
          />
        </div>
      ) : roles.state.status === "loading" ? (
        showSkeleton ? (
          <div className={cn(CARD, "overflow-hidden")} aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-border-soft border-b px-4 py-4 last:border-b-0"
              >
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
                <Skeleton className="hidden h-5 w-16 md:block" />
              </div>
            ))}
          </div>
        ) : null
      ) : (
        <div className={cn(CARD, "overflow-hidden")}>
          <div
            aria-hidden="true"
            className={cn(
              "hidden h-10 border-border-soft border-b bg-bg-fill1 px-4 font-medium text-[14px] text-text-secondary",
              GRID,
            )}
          >
            <span>Role</span>
            <span>Type</span>
            <span>Members</span>
            <span>Last changed</span>
            <span />
          </div>
          <ul>
            {(ready?.roles ?? []).map((role) => (
              <li
                key={role.id}
                className={cn(
                  "flex flex-col gap-2 border-border-soft border-b px-4 py-3.5 last:border-b-0",
                  GRID,
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium text-[14px] text-text leading-5">{role.name}</p>
                  <p className="truncate text-[12px] text-text-tertiary leading-4">
                    {role.description || accessSummary(role.permissions)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:contents">
                  <span>
                    <Badge tone={role.builtIn ? "neutral" : "orange"}>
                      {role.builtIn ? "Built-in" : "Custom"}
                    </Badge>
                  </span>
                  <span className="text-[14px] text-text-secondary">
                    <span className="md:hidden">Members </span>
                    {role.members}
                  </span>
                  <span className="text-[14px] text-text-secondary">
                    {role.updatedAt
                      ? [role.updatedBy, dayMonth(role.updatedAt)].filter(Boolean).join(" · ")
                      : "—"}
                  </span>
                  <Link
                    href={`/roles/detail?id=${encodeURIComponent(role.id)}`}
                    aria-label={`${role.builtIn || !canManage ? "View" : "Edit"} ${role.name}`}
                    className={cn(
                      "ml-auto rounded-md font-medium text-[14px] text-text hover:underline md:ml-0",
                      FOCUS,
                    )}
                  >
                    {role.builtIn || !canManage ? "View" : "Edit"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
