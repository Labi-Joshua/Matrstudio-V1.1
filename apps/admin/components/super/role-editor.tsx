"use client";

import { cn } from "@matr/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createRole, duplicateRole, getRole, getRoles } from "../../lib/super/api";
import { useLoader, useOnlineStatus, useSkeletonGate } from "../../lib/super/hooks";
import { emptyPermissions, samePermissions, validateRoleName } from "../../lib/super/matrix";
import type { Permissions, RoleDetail } from "../../lib/super/types";
import { can, useMe } from "../../lib/super/use-me";
import { ArrowLeftIcon, CopyIcon, LockIcon, ShieldIcon, TrashIcon } from "./icons";
import { useReauth } from "./reauth";
import { MenuPreview, RoleMatrix } from "./role-matrix";
import { DeleteRoleModal, roleErrorMessage, SaveRoleModal } from "./role-modals";
import { useToast } from "./toast";
import {
  Badge,
  Banner,
  Button,
  CARD,
  EmptyState,
  ErrorState,
  Field,
  FOCUS,
  INPUT,
  PageHeader,
  Skeleton,
} from "./ui";

const Back = () => (
  <Link
    href="/roles"
    className={cn(
      "inline-flex w-fit items-center gap-1 rounded-md font-medium text-[14px] text-text-secondary leading-5 hover:text-text",
      FOCUS,
    )}
  >
    <ArrowLeftIcon size={18} />
    Roles and permissions
  </Link>
);

/** /roles/new: create a custom role (Figma SA4.3). */
export function NewRoleScreen() {
  return <Editor mode="new" />;
}

/** /roles/detail?id=: built-in roles read-only (SA4.2), custom roles editable (SA4.3 to SA4.5). */
export function RoleDetailScreen() {
  const id = useSearchParams().get("id") ?? "";
  return <Editor mode="detail" id={id} />;
}

function Editor({ mode, id = "" }: { mode: "new" | "detail"; id?: string }) {
  const online = useOnlineStatus();
  const detail = useLoader(
    () => (mode === "new" ? Promise.resolve({ ok: true as const, data: null }) : getRole(id)),
    [mode, id],
  );
  const showSkeleton = useSkeletonGate(detail.state.status === "loading");

  if (mode === "detail" && !id) {
    return (
      <>
        <Back />
        <div className={CARD}>
          <EmptyState title="No role picked" body="Open one from the roles list." />
        </div>
      </>
    );
  }
  if (detail.state.status === "error") {
    return (
      <>
        <Back />
        <div className={CARD}>
          {detail.state.code === "not_found" ? (
            <EmptyState title="That role doesn’t exist" body="It may have been deleted." />
          ) : (
            <ErrorState
              offline={!online}
              title={online ? "We couldn’t load this role" : "You’re offline"}
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
        <Back />
        {showSkeleton ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        ) : null}
      </>
    );
  }
  return <Form role={detail.state.data} reload={detail.reload} />;
}

function Form({ role, reload }: { role: RoleDetail | null; reload: () => void }) {
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const me = useMe();
  const { run, dialog } = useReauth();
  const roles = useLoader(getRoles, []);
  const isNew = role === null;
  const builtIn = role?.builtIn ?? false;
  const canManage = can(me, "roles", "manage");
  const readOnly = builtIn || !canManage;

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [perms, setPerms] = useState<Permissions>(role?.permissions ?? emptyPermissions());
  const [nameError, setNameError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty =
    isNew ||
    name !== role.name ||
    description !== role.description ||
    !samePermissions(perms, role.permissions);

  useEffect(() => {
    if (search.get("created") === "1") {
      toast({ tone: "success", title: "Role created", body: "You can fine-tune it here." });
    }
  }, [search, toast]);
  useEffect(() => {
    if (!dirty || readOnly) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, readOnly]);

  const body = { name: name.trim(), description: description.trim(), permissions: perms };
  const custom =
    roles.state.status === "ready" ? roles.state.data.roles.filter((r) => !r.builtIn).length : 0;
  const limit = roles.state.status === "ready" ? roles.state.data.customLimit : 20;
  const capped = isNew && custom >= limit;

  const failName = (message: string) => setNameError(message);

  const create = async () => {
    const problem = validateRoleName(name);
    if (problem) return setNameError(problem);
    setBusy(true);
    const result = await run(() => createRole(body));
    setBusy(false);
    if (result.ok) {
      router.push(`/roles/detail?id=${encodeURIComponent(result.data.id)}&created=1`);
    } else if (result.code === "role_name_taken") {
      failName(roleErrorMessage(result));
    } else {
      toast({ tone: "error", title: "Role wasn’t saved", body: roleErrorMessage(result) });
    }
  };

  const saveClick = () => {
    const problem = validateRoleName(name);
    if (problem) return setNameError(problem);
    setConfirm(true);
  };

  const duplicate = async () => {
    if (!role) return;
    setBusy(true);
    const result = await run(() => duplicateRole(role.id));
    setBusy(false);
    if (result.ok) {
      router.push(`/roles/detail?id=${encodeURIComponent(result.data.id)}&created=1`);
    } else {
      toast({ tone: "error", title: "Couldn’t duplicate", body: roleErrorMessage(result) });
    }
  };

  const title = isNew ? "New role" : role.name;
  const subtitle = isNew
    ? "Set what this role can see and do in each area."
    : `${role.members} ${role.members === 1 ? "person" : "people"}${
        role.description ? ` · ${role.description}` : ""
      }`;

  return (
    <>
      <Back />
      <PageHeader
        title={title}
        subtitle={subtitle}
        badge={
          isNew ? null : (
            <Badge tone={builtIn ? "neutral" : "orange"}>{builtIn ? "Built-in" : "Custom"}</Badge>
          )
        }
        actions={
          isNew ? (
            <>
              <Button onClick={() => router.push("/roles")}>Cancel</Button>
              <Button kind="primary" onClick={create} disabled={busy || capped} aria-busy={busy}>
                {busy ? "Saving…" : "Save role"}
              </Button>
            </>
          ) : builtIn ? (
            canManage ? (
              <Button onClick={duplicate} disabled={busy}>
                <CopyIcon size={18} />
                Duplicate as custom role
              </Button>
            ) : null
          ) : canManage ? (
            <>
              <Button kind="danger-outline" onClick={() => setDeleting(true)} disabled={busy}>
                <TrashIcon size={18} />
                Delete role
              </Button>
              <Button kind="primary" onClick={saveClick} disabled={!dirty || busy}>
                Save changes
              </Button>
            </>
          ) : null
        }
      />

      {builtIn ? (
        <Banner icon={<LockIcon size={18} />}>
          Built-in roles can’t be edited. Duplicate this one to make a custom role.
        </Banner>
      ) : !canManage ? (
        <Banner icon={<LockIcon size={18} />}>Only Super admins can change roles.</Banner>
      ) : null}
      {capped ? (
        <Banner tone="warning" icon={<ShieldIcon size={18} />}>
          You’ve used all {limit} custom roles. Delete one before creating another.
        </Banner>
      ) : null}
      {!readOnly && perms.audit_log !== "none" ? (
        <Banner tone="warning" icon={<ShieldIcon size={18} />}>
          Sensitive: View on Audit log shows who changed what across the portal. Give it only to
          people who need it.
        </Banner>
      ) : null}

      {readOnly ? null : (
        <div className="grid gap-4 rounded-2xl bg-bg-fill1 p-4 md:grid-cols-2">
          <Field label="Role name" htmlFor="role-name" error={nameError}>
            <input
              id="role-name"
              maxLength={60}
              value={name}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "role-name-error" : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(undefined);
              }}
              className={cn(INPUT, FOCUS, nameError && "border-error-border")}
            />
          </Field>
          <Field label="Description" htmlFor="role-desc">
            <input
              id="role-desc"
              maxLength={160}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(INPUT, FOCUS)}
            />
          </Field>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <RoleMatrix permissions={perms} onChange={setPerms} readOnly={readOnly} />
        {readOnly ? null : <MenuPreview permissions={perms} />}
      </div>

      {confirm && role ? (
        <SaveRoleModal
          role={role}
          body={body}
          reauth={run}
          onClose={() => setConfirm(false)}
          onSaved={() => {
            setConfirm(false);
            toast({
              tone: "success",
              title: "Role saved",
              body: "The change is in the audit log.",
            });
            reload();
          }}
        />
      ) : null}
      {deleting && role ? (
        <DeleteRoleModal
          role={role}
          others={
            roles.state.status === "ready"
              ? roles.state.data.roles.filter((r) => r.id !== role.id)
              : []
          }
          reauth={run}
          onClose={() => setDeleting(false)}
          onDeleted={() => router.push("/roles")}
        />
      ) : null}
      {dialog}
    </>
  );
}
