"use client";

import { cn } from "@matr/ui";
import { useState } from "react";
import type { ApiFailure } from "../../lib/api";
import { getRoles, inviteAdmin } from "../../lib/super/api";
import { useLoader } from "../../lib/super/hooks";
import type { Member } from "../../lib/super/types";
import { ClockIcon, UserPlusIcon } from "./icons";
import { InlineError, Inset, Modal, ModalFooter } from "./modal";
import type { useReauth } from "./reauth";
import { useToast } from "./toast";
import { Field, FOCUS, INPUT, Select } from "./ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Role helper lines under the select (built-in copy from the design; custom roles use their description). */
const ROLE_HELP: Record<string, string> = {
  super_admin: "Super admins have full control, including roles and the admin team.",
  admin: "Day-to-day running of the portal.",
  curator: "Curators manage resources, paths, review queues and Home curation.",
  support: "Support handles users, the support inbox and the support dashboard.",
};

/**
 * Invite an admin (Figma SA2.2, SA2.3, error 673:26898). POST /team/invite {email, roleId, name?},
 * needs fresh auth (the re-auth prompt opens on 401 reauth_required). A person already on the team
 * gets the inline "already on the team" message; any other failure keeps the form and shows an
 * "Invite didn't send" toast.
 */
export function InviteModal({
  members,
  presetRoleId,
  reauth,
  onClose,
  onSent,
}: {
  members: Member[];
  presetRoleId?: string;
  reauth: ReturnType<typeof useReauth>["run"];
  onClose: () => void;
  onSent: (email: string) => void;
}) {
  const toast = useToast();
  const roles = useLoader(getRoles, []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(presetRoleId ?? "");
  const [errors, setErrors] = useState<{ email?: string; role?: string; name?: string }>({});
  const [busy, setBusy] = useState(false);

  const roleList = roles.state.status === "ready" ? roles.state.data.roles : [];
  const chosen = roleList.find((r) => r.id === roleId);
  const help = chosen ? ROLE_HELP[chosen.id] || chosen.description : "";

  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    const next: typeof errors = {};
    if (!EMAIL.test(trimmed)) next.email = "Enter a valid email address.";
    if (!roleId) next.role = "Pick a role.";
    const existing = members.find((m) => m.email.toLowerCase() === trimmed);
    if (existing) next.email = `${existing.name} is already on the team.`;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    const result = await reauth(() =>
      inviteAdmin({ email: trimmed, roleId, ...(name.trim() ? { name: name.trim() } : {}) }),
    );
    setBusy(false);
    if (result.ok) {
      onSent(trimmed);
      return;
    }
    handleFailure(result);
  };

  const handleFailure = (failure: ApiFailure) => {
    if (failure.code === "admin_exists") {
      setErrors({ email: "That person is already on the team." });
    } else if (failure.fieldErrors) {
      setErrors({
        email: failure.fieldErrors.email,
        role: failure.fieldErrors.roleId,
        name: failure.fieldErrors.name,
      });
    } else {
      toast({ tone: "error", title: "Invite didn’t send", body: failure.message });
    }
  };

  return (
    <Modal
      icon={<UserPlusIcon />}
      title="Invite an admin"
      subtitle="They’ll get an email with a link to join the admin team."
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      footer={
        <ModalFooter
          onCancel={onClose}
          confirmLabel="Send invite"
          busyLabel="Sending…"
          busy={busy}
          disabled={roles.state.status !== "ready"}
        />
      }
    >
      <Inset>
        <Field label="Full name (optional)" htmlFor="invite-name" error={errors.name}>
          <input
            id="invite-name"
            data-autofocus
            autoComplete="off"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(INPUT, FOCUS)}
          />
        </Field>
        <Field label="Email" htmlFor="invite-email" error={errors.email}>
          <input
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            maxLength={254}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "invite-email-error" : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(INPUT, FOCUS, errors.email && "border-error-border")}
          />
        </Field>
      </Inset>
      <Field label="Role" htmlFor="invite-role" hint={help || undefined} error={errors.role}>
        <Select
          id="invite-role"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          disabled={roles.state.status !== "ready"}
        >
          <option value="">
            {roles.state.status === "loading"
              ? "Loading roles…"
              : roles.state.status === "error"
                ? "Couldn’t load roles"
                : "Choose a role"}
          </option>
          {roleList.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.builtIn ? "" : " (custom)"}
            </option>
          ))}
        </Select>
      </Field>
      {roles.state.status === "error" ? (
        <InlineError>
          We couldn’t load the roles.{" "}
          <button type="button" onClick={roles.reload} className={cn("underline", FOCUS)}>
            Try again
          </button>
        </InlineError>
      ) : null}
      <div className="flex items-start gap-2.5 rounded-xl bg-bg-fill1 px-3.5 py-3 text-[13px] text-text-secondary leading-[18px]">
        <ClockIcon size={16} className="mt-px shrink-0" />
        <p>
          Invites expire after 72 hours. They set a password and a 2-step code before they can sign
          in.
        </p>
      </div>
    </Modal>
  );
}
