"use client";

import { cn } from "@matr/ui";
import { useState } from "react";
import type { ApiResult } from "../../lib/api";
import { deleteRole, previewRoleUpdate, updateRole } from "../../lib/super/api";
import { useLoader } from "../../lib/super/hooks";
import { diffPermissions } from "../../lib/super/matrix";
import type { Permissions, RoleDetail, RoleSummary } from "../../lib/super/types";
import { ScrollIcon, TrashIcon, UsersIcon } from "./icons";
import { InlineError, Inset, Modal, ModalFooter } from "./modal";
import type { useReauth } from "./reauth";
import { Field, Select, Skeleton } from "./ui";

type Reauth = ReturnType<typeof useReauth>["run"];

export const roleErrorMessage = (f: Extract<ApiResult<unknown>, { ok: false }>): string => {
  if (f.code === "reauth_required") return "Confirm it’s you to continue.";
  if (f.code === "role_limit") return "You’ve used all 20 custom roles. Delete one first.";
  if (f.code === "role_name_taken") return "A role with that name already exists.";
  if (f.code === "level_not_allowed") return "One of the levels is above what this area allows.";
  return f.message;
};

/** Save changes confirm (SA4.4): the diff, who is affected, then PUT /roles/:id. */
export function SaveRoleModal({
  role,
  body,
  reauth,
  onClose,
  onSaved,
}: {
  role: RoleDetail;
  body: { name: string; description?: string; permissions: Permissions };
  reauth: Reauth;
  onClose: () => void;
  onSaved: () => void;
}) {
  const preview = useLoader(() => previewRoleUpdate(role.id, body), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const ready = preview.state.status === "ready" ? preview.state.data : null;
  const diff = ready?.diff ?? diffPermissions(role.permissions, body.permissions);
  const affected = ready?.affected ?? role.memberList;
  const n = role.members;

  const save = async () => {
    setBusy(true);
    const result = await reauth(() => updateRole(role.id, body));
    setBusy(false);
    if (result.ok) onSaved();
    else setError(roleErrorMessage(result));
  };

  return (
    <Modal
      icon={<UsersIcon />}
      title={`Save changes to ${role.name}?`}
      subtitle={
        n > 0
          ? `This changes access for ${n} ${n === 1 ? "person" : "people"} straight away.`
          : "No one has this role yet."
      }
      onClose={onClose}
      busy={busy}
      onSubmit={save}
      footer={
        <ModalFooter
          onCancel={onClose}
          confirmLabel="Save changes"
          busyLabel="Saving…"
          busy={busy}
          disabled={preview.state.status === "loading"}
        />
      }
    >
      <Inset>
        {preview.state.status === "loading" ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            {diff.length === 0 ? (
              <p className="text-[14px] text-text-secondary">
                Only the name or description changed.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 text-[14px] text-text">
                {diff.map((line) => (
                  <li key={line.label}>
                    {line.label}: {line.before} → {line.after}
                  </li>
                ))}
              </ul>
            )}
            {affected.length > 0 ? (
              <ul className="flex list-disc flex-col gap-1.5 border-border-soft border-t pt-3 pl-5 text-[13px] text-text-secondary">
                {affected.map((m) => (
                  <li key={m.id}>{m.name}</li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </Inset>
      {preview.state.status === "error" ? (
        <p className="text-[13px] text-text-tertiary">
          The server preview isn’t available; the list above is worked out from your edits.
        </p>
      ) : null}
      <div className="flex items-start gap-2.5 rounded-xl bg-bg-fill1 px-3.5 py-3 text-[13px] text-text-secondary leading-[18px]">
        <ScrollIcon size={16} className="mt-px shrink-0" />
        <p>The change is saved to the audit log.</p>
      </div>
      <InlineError>{error}</InlineError>
    </Modal>
  );
}

/** Delete role (SA4.5): members must be moved first. */
export function DeleteRoleModal({
  role,
  others,
  reauth,
  onClose,
  onDeleted,
}: {
  role: RoleDetail;
  others: RoleSummary[];
  reauth: Reauth;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [target, setTarget] = useState(
    others.find((r) => r.id === "support")?.id ?? others[0]?.id ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const n = role.members;

  const submit = async () => {
    if (n > 0 && !target) {
      setError("Pick a role to move them to.");
      return;
    }
    setBusy(true);
    const result = await reauth(() => deleteRole(role.id, n > 0 ? target : undefined));
    setBusy(false);
    if (result.ok) onDeleted();
    else setError(roleErrorMessage(result));
  };

  return (
    <Modal
      icon={<TrashIcon />}
      tone="danger"
      title={
        n > 0
          ? `Move ${n} ${n === 1 ? "person" : "people"} before deleting`
          : `Delete ${role.name}?`
      }
      subtitle={
        n > 0
          ? `${role.name} still has members. Pick a role to move them to.`
          : "No one has this role. This can’t be undone."
      }
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      footer={
        <ModalFooter
          onCancel={onClose}
          confirmLabel={n > 0 ? "Move and delete role" : "Delete role"}
          busyLabel="Deleting…"
          busy={busy}
          kind="danger"
        />
      }
    >
      {n > 0 ? (
        <>
          <ul className="flex list-disc flex-col gap-2 rounded-2xl bg-bg-fill1 py-4 pr-4 pl-9 text-[13px] text-text-secondary">
            {role.memberList.map((m) => (
              <li key={m.id}>{m.name}</li>
            ))}
          </ul>
          <Field label="Move them to" htmlFor="move-to">
            <Select
              id="move-to"
              data-autofocus
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {others.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </>
      ) : null}
      <InlineError>{error}</InlineError>
      <span className={cn("sr-only")} aria-live="polite">
        {busy ? "Deleting" : ""}
      </span>
    </Modal>
  );
}
