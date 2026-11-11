"use client";

import { cn } from "@matr/ui";
import { useState } from "react";
import type { ApiResult } from "../../lib/api";
import {
  getRoles,
  removeMember,
  setMemberRole,
  setTemporaryAccess,
  signOutEverywhere,
  suspendMember,
} from "../../lib/super/api";
import {
  agoLabel,
  dateInputValue,
  endOfDayIso,
  firstName,
  possessive,
} from "../../lib/super/format";
import { useLoader } from "../../lib/super/hooks";
import { type MemberDetail, SUPER_ADMIN_ID } from "../../lib/super/types";
import { CodeInput } from "./code-input";
import { ClockIcon, KeyIcon, LockIcon, LogOutIcon, MailIcon, ShieldIcon, TrashIcon } from "./icons";
import { InlineError, Inset, Modal, ModalFooter } from "./modal";
import type { useReauth } from "./reauth";
import { Button, Field, FOCUS, INPUT, Select, Skeleton } from "./ui";

type Reauth = ReturnType<typeof useReauth>["run"];
export type ModalProps = {
  member: MemberDetail;
  reauth: Reauth;
  onClose: () => void;
  /** The action worked: the parent closes the modal, reloads and shows the toast. */
  onDone: (title: string, body?: string) => void;
};

const NEEDS_FRESH = "Confirm it’s you to continue.";
const messageOf = (result: Extract<ApiResult<unknown>, { ok: false }>) =>
  result.code === "reauth_required" ? NEEDS_FRESH : result.message;

/** Runs one action with busy and error state, shared by the modals below. */
function useSubmit(reauth: Reauth, onDone: ModalProps["onDone"]) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const submit = async (
    action: () => Promise<ApiResult<unknown>>,
    success: { title: string; body?: string },
  ) => {
    setBusy(true);
    setError(undefined);
    const result = await reauth(action);
    setBusy(false);
    if (result.ok) onDone(success.title, success.body);
    else setError(messageOf(result));
  };
  return { busy, error, setError, submit };
}

/** Change role (SA3.2): one role per person. Choosing Super admin continues to the 2-step code (SA3.3). */
export function ChangeRoleModal({ member, reauth, onClose, onDone }: ModalProps) {
  const roles = useLoader(getRoles, []);
  const [roleId, setRoleId] = useState(member.roleId);
  const [step, setStep] = useState<"pick" | "code">("pick");
  const [code, setCode] = useState("");
  const { busy, error, setError, submit } = useSubmit(reauth, onDone);
  const list = roles.state.status === "ready" ? roles.state.data.roles : [];
  const chosen = list.find((r) => r.id === roleId);
  const name = firstName(member.name);
  const toSuper = roleId === SUPER_ADMIN_ID && member.roleId !== SUPER_ADMIN_ID;

  const save = (twoStepCode?: string) =>
    submit(() => setMemberRole(member.id, roleId, twoStepCode), {
      title: "Role updated",
      body: `${name} is now ${chosen?.name ?? "updated"}.`,
    });

  if (step === "code") {
    return (
      <Modal
        icon={<ShieldIcon />}
        title="Confirm with your 2-step code"
        subtitle={`Making ${name} a Super admin gives full control, including roles and the admin team.`}
        onClose={onClose}
        busy={busy}
        onSubmit={() => (code.length === 6 ? save(code) : setError("Enter the 6 digits."))}
        footer={
          <ModalFooter
            onCancel={onClose}
            confirmLabel="Confirm"
            busyLabel="Confirming…"
            busy={busy}
            disabled={code.length < 6}
          />
        }
      >
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-text-secondary">6-digit code from your app</p>
          <CodeInput
            value={code}
            onChange={(v) => {
              setCode(v);
              setError(undefined);
            }}
            label="2-step code"
            invalid={Boolean(error)}
          />
          <InlineError>{error}</InlineError>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      icon={<KeyIcon />}
      title={`Change ${possessive(name)} role`}
      subtitle="Pick a role. Each person has one role."
      onClose={onClose}
      busy={busy}
      onSubmit={() => (toSuper ? setStep("code") : save())}
      footer={
        <ModalFooter
          onCancel={onClose}
          confirmLabel={toSuper ? "Continue" : "Save role"}
          busyLabel="Saving…"
          busy={busy}
          disabled={roleId === member.roleId || roles.state.status !== "ready"}
        />
      }
    >
      {roles.state.status === "loading" ? (
        <Inset>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </Inset>
      ) : roles.state.status === "error" ? (
        <InlineError>
          We couldn’t load the roles.{" "}
          <button type="button" className={cn("underline", FOCUS)} onClick={roles.reload}>
            Try again
          </button>
        </InlineError>
      ) : (
        <fieldset className="m-0 border-0 p-0">
          <legend className="sr-only">Role</legend>
          <Inset>
            {list.map((role) => (
              <label key={role.id} className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="member-role"
                  value={role.id}
                  checked={roleId === role.id}
                  onChange={() => setRoleId(role.id)}
                  className={cn("mt-0.5 size-4 accent-primary", FOCUS)}
                />
                <span className="min-w-0">
                  <span className="block text-[14px] text-text leading-5">
                    {role.name}
                    {role.builtIn ? "" : " (custom)"}
                  </span>
                  {role.description ? (
                    <span className="block text-[13px] text-text-tertiary leading-[18px]">
                      {role.description}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </Inset>
        </fieldset>
      )}
      <InlineError>{error}</InlineError>
      <div className="flex items-start gap-2.5 rounded-xl bg-bg-fill1 px-3.5 py-3 text-[13px] text-text-secondary leading-[18px]">
        <MailIcon size={16} className="mt-px shrink-0" />
        <p>
          {name} is signed out of every session so the new access applies when they sign back in.
          The change is saved to the audit log.
        </p>
      </div>
    </Modal>
  );
}

/** Temporary access (SA3.5): the role stays until the end of the picked day. */
export function TemporaryAccessModal({ member, reauth, onClose, onDone }: ModalProps) {
  const name = firstName(member.name);
  const tomorrow = dateInputValue(Date.now() + 86_400_000);
  const [date, setDate] = useState(
    member.accessExpiresAt ? dateInputValue(member.accessExpiresAt) : "",
  );
  const { busy, error, setError, submit } = useSubmit(reauth, onDone);

  const save = () => {
    const iso = endOfDayIso(date);
    if (!iso || date < tomorrow) {
      setError("Pick a date from tomorrow onwards.");
      return;
    }
    submit(() => setTemporaryAccess(member.id, iso), {
      title: "Temporary access set",
      body: `${name}’s access ends at the end of ${date}.`,
    });
  };

  return (
    <Modal
      icon={<ClockIcon />}
      title="Give temporary access"
      subtitle={`${name} keeps their role until the date you pick.`}
      onClose={onClose}
      busy={busy}
      onSubmit={save}
      footer={
        <>
          {member.accessExpiresAt !== null ? (
            <Button
              kind="link"
              className="sm:mr-auto"
              disabled={busy}
              onClick={() =>
                submit(() => setTemporaryAccess(member.id, null), {
                  title: "Access is permanent",
                  body: `${possessive(name)} access no longer has an end date.`,
                })
              }
            >
              Make permanent
            </Button>
          ) : null}
          <ModalFooter
            onCancel={onClose}
            confirmLabel="Save"
            busyLabel="Saving…"
            busy={busy}
            disabled={!date}
          />
        </>
      }
    >
      <Inset>
        <Field label="Access ends on" htmlFor="temp-date">
          <input
            id="temp-date"
            data-autofocus
            type="date"
            min={tomorrow}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setError(undefined);
            }}
            className={cn(INPUT, FOCUS)}
          />
        </Field>
        <Field label="Then" htmlFor="temp-then">
          <Select id="temp-then" value="remove" disabled onChange={() => {}}>
            <option value="remove">Remove access</option>
          </Select>
        </Field>
      </Inset>
      <InlineError>{error}</InlineError>
      <div className="flex items-start gap-2.5 rounded-xl bg-bg-fill1 px-3.5 py-3 text-[13px] text-text-secondary leading-[18px]">
        <ClockIcon size={16} className="mt-px shrink-0" />
        <p>Access ends at the end of that day and {name} is signed out.</p>
      </div>
    </Modal>
  );
}

/** Suspend access (SA3.6): reason required, role stays. */
export function SuspendModal({ member, reauth, onClose, onDone }: ModalProps) {
  const name = firstName(member.name);
  const [reason, setReason] = useState("");
  const { busy, error, setError, submit } = useSubmit(reauth, onDone);
  const save = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Add a reason. It is saved in the audit log.");
      return;
    }
    submit(() => suspendMember(member.id, trimmed), {
      title: `${member.name} is suspended`,
      body: "They’re signed out everywhere. Restore access any time.",
    });
  };
  return (
    <Modal
      icon={<LockIcon />}
      tone="danger"
      title={`Suspend ${member.name}?`}
      subtitle={`${name} can’t sign in until you restore access. Their role stays.`}
      onClose={onClose}
      busy={busy}
      onSubmit={save}
      footer={
        <ModalFooter
          onCancel={onClose}
          confirmLabel="Suspend access"
          busyLabel="Suspending…"
          busy={busy}
          kind="danger"
        />
      }
    >
      <Field label="Reason" htmlFor="suspend-reason" hint="Saved in the audit log with your name.">
        <textarea
          id="suspend-reason"
          data-autofocus
          rows={4}
          maxLength={500}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(undefined);
          }}
          className={cn(INPUT, FOCUS, "h-auto resize-none py-2.5")}
        />
      </Field>
      <InlineError>{error}</InlineError>
    </Modal>
  );
}

/** Remove access (SA3.7): irreversible, needs the "I understand" box. */
export function RemoveModal({ member, reauth, onClose, onDone }: ModalProps) {
  const name = firstName(member.name);
  const [sure, setSure] = useState(false);
  const { busy, error, submit } = useSubmit(reauth, onDone);
  return (
    <Modal
      icon={<TrashIcon />}
      tone="danger"
      title={`Remove ${name} from the admin team?`}
      subtitle="This can’t be undone. You can invite them again later."
      onClose={onClose}
      busy={busy}
      onSubmit={() =>
        sure
          ? submit(() => removeMember(member.id), {
              title: `${member.name} was removed`,
              body: "Their work stays, credited as “Former admin”.",
            })
          : undefined
      }
      footer={
        <ModalFooter
          onCancel={onClose}
          confirmLabel="Remove access"
          busyLabel="Removing…"
          busy={busy}
          disabled={!sure}
          kind="danger"
        />
      }
    >
      <ul className="flex list-disc flex-col gap-2 rounded-2xl bg-bg-fill1 py-4 pr-4 pl-9 text-[13px] text-text-secondary leading-[18px]">
        <li>Signed out of every session straight away</li>
        <li>Invites they sent are cancelled</li>
        <li>Their work stays, credited as “Former admin”</li>
      </ul>
      <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-text">
        <input
          data-autofocus
          type="checkbox"
          checked={sure}
          onChange={(e) => setSure(e.target.checked)}
          className={cn("size-4 accent-primary", FOCUS)}
        />
        I understand
      </label>
      <InlineError>{error}</InlineError>
    </Modal>
  );
}

/** Sign out everywhere (SA5.4): lists the live sessions first. */
export function SignOutModal({ member, reauth, onClose, onDone }: ModalProps) {
  const name = firstName(member.name);
  const { busy, error, submit } = useSubmit(reauth, onDone);
  const n = member.sessions.length || member.sessionCount;
  return (
    <Modal
      icon={<LogOutIcon />}
      title={`Sign ${name} out everywhere?`}
      subtitle={
        n > 0
          ? `They’ll be signed out of ${n} ${n === 1 ? "session" : "sessions"} straight away.`
          : "They have no active sessions right now."
      }
      onClose={onClose}
      busy={busy}
      onSubmit={() =>
        submit(() => signOutEverywhere(member.id), {
          title: `${name} was signed out everywhere`,
          body: "They need their password and 2-step code to sign back in.",
        })
      }
      footer={
        <ModalFooter
          onCancel={onClose}
          confirmLabel="Sign out everywhere"
          busyLabel="Signing out…"
          busy={busy}
        />
      }
    >
      {member.sessions.length > 0 ? (
        <ul className="flex list-disc flex-col gap-2 rounded-2xl bg-bg-fill1 py-4 pr-4 pl-9 text-[13px] text-text-secondary leading-[18px]">
          {member.sessions.map((s) => (
            <li key={s.id}>
              {[s.device, s.location, s.current ? "active now" : agoLabel(s.lastActiveAt)]
                .filter(Boolean)
                .join(" · ")}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-start gap-2.5 rounded-xl bg-bg-fill1 px-3.5 py-3 text-[13px] text-text-secondary leading-[18px]">
        <ShieldIcon size={16} className="mt-px shrink-0" />
        <p>They’ll need their password and 2-step code to sign back in.</p>
      </div>
      <InlineError>{error}</InlineError>
    </Modal>
  );
}
