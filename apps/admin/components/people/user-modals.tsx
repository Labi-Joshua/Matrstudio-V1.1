"use client";

import { useId, useRef, useState } from "react";
import type { ApiFailure } from "../../lib/api";
import { deleteUser, reauth, suspendUser } from "../../lib/people/api";
import { firstName } from "../../lib/people/format";
import { deleteConfirmed, SUSPEND_REASONS } from "../../lib/people/logic";
import type { UserDetail } from "../../lib/people/types";
import { Modal, ModalNote } from "./modal";
import { failureToast, useToast } from "./toast";
import { BTN_DANGER, BTN_SECONDARY, FIELD, INPUT, LABEL, PATHS, TEXTAREA } from "./ui";

function ErrorLine({ children }: { children: string | null }) {
  return children ? (
    <p role="alert" className="text-[14px] text-error-text leading-5">
      {children}
    </p>
  ) : null;
}

/** Suspend with a reason (Figma US4). The person is signed out everywhere; the reason is emailed and audited. */
export function SuspendModal({
  user,
  onClose,
  onDone,
}: {
  user: UserDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const reasonId = useId();
  const messageId = useId();
  const [reason, setReason] = useState<string>(SUSPEND_REASONS[0].value);
  const [message, setMessage] = useState<string>(SUSPEND_REASONS[0].message);
  const edited = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(value: string) {
    setReason(value);
    const found = SUSPEND_REASONS.find((r) => r.value === value);
    if (found && !edited.current) setMessage(found.message);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await suspendUser(user.id, { reason, message: message.trim() });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      toast(failureToast("Couldn’t suspend the account", r.message));
      return;
    }
    toast({
      tone: "success",
      title: "Account suspended",
      body: `${firstName(user.name)} was signed out and emailed the reason.`,
    });
    onDone();
    onClose();
  }

  return (
    <Modal
      title={`Suspend ${user.name}?`}
      subtitle="They’re signed out everywhere and can’t sign in until you restore access."
      icon={PATHS.lock}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || message.trim().length < 1}
            className={BTN_DANGER}
          >
            {busy ? "Suspending…" : "Suspend account"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={reasonId} className={LABEL}>
          Reason
        </label>
        <select
          id={reasonId}
          value={reason}
          onChange={(e) => pick(e.target.value)}
          className={`${FIELD} h-10`}
        >
          {SUSPEND_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={messageId} className={LABEL}>
          Message they’ll get by email
        </label>
        <textarea
          id={messageId}
          value={message}
          maxLength={1000}
          onChange={(e) => {
            edited.current = true;
            setMessage(e.target.value);
          }}
          className={`${TEXTAREA} min-h-[110px]`}
        />
      </div>
      <ModalNote icon={PATHS.scroll}>
        Logged in the audit log with your name and the reason.
      </ModalNote>
      <ErrorLine>{error}</ErrorLine>
    </Modal>
  );
}

/**
 * Delete account (Figma US6): Super admin only. Needs the typed email, and a fresh sign-in check:
 * when the API answers reauth_required the modal asks for the password and 2-step code, then retries.
 */
export function DeleteModal({
  user,
  onClose,
  onDeleted,
}: {
  user: UserDetail;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const typedId = useId();
  const [typed, setTyped] = useState("");
  const [emailCopy, setEmailCopy] = useState(true);
  const [step, setStep] = useState<"confirm" | "reauth">("confirm");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completed = user.paths.filter((p) => p.state === "completed").length;
  const started = user.paths.filter((p) => p.state !== "saved").length;
  const openTickets = user.tickets.filter(
    (t) => !["resolved", "fixed", "cant_reproduce"].includes(t.status),
  ).length;
  const name = firstName(user.name);

  async function run(): Promise<ApiFailure | null> {
    const r = await deleteUser(user.id, { confirm: user.email, emailCopy });
    return r.ok ? null : r;
  }

  async function submit() {
    setBusy(true);
    setError(null);
    if (step === "reauth") {
      const check = await reauth({ password, code: code.replace(/\s/g, "") });
      if (!check.ok) {
        setBusy(false);
        setError(
          check.code === "reauth_failed"
            ? "That didn’t match. Check your password and code."
            : check.message,
        );
        return;
      }
    }
    const failure = await run();
    setBusy(false);
    if (!failure) {
      toast({
        tone: "success",
        title: "Account deleted",
        body: `${user.name}’s account and data were removed.`,
      });
      onDeleted();
      return;
    }
    if (failure.code === "reauth_required") {
      setStep("reauth");
      setPassword("");
      setCode("");
      setError(null);
      return;
    }
    setError(
      failure.code === "forbidden" ? "Only a Super admin can delete an account." : failure.message,
    );
    toast(failureToast("Account not deleted", "Nothing was changed."));
  }

  const ready =
    step === "confirm"
      ? deleteConfirmed(typed, user.email)
      : deleteConfirmed(typed, user.email) &&
        password.length > 0 &&
        /^\d{6}$|^[A-Za-z0-9-]{8,}$/.test(code.replace(/\s/g, ""));

  return (
    <Modal
      title={`Delete ${user.name}’s account?`}
      subtitle={`${name} asked us to delete their account. This removes their profile, progress and saved items for good.`}
      icon={PATHS.trash}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy || !ready} className={BTN_DANGER}>
            {busy ? "Deleting…" : step === "reauth" ? "Confirm and delete" : "Delete account"}
          </button>
        </>
      }
    >
      <dl className="flex flex-col gap-3 rounded-xl bg-bg-fill1 p-5 text-[14px] leading-5 tracking-[-0.14px]">
        {(
          [
            ["Paths", `${started} (${completed} completed)`],
            ["Submissions", "Approved ones stay, credited to “Former member”"],
            ["Help requests", `${openTickets} open · closed on delete`],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_1fr] gap-3">
            <dt className="text-text-secondary">{k}</dt>
            <dd className="text-text">{v}</dd>
          </div>
        ))}
      </dl>
      <label className="flex items-center gap-2 text-[14px] text-text leading-5">
        <input
          type="checkbox"
          checked={emailCopy}
          onChange={(e) => setEmailCopy(e.target.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        Email {name} a copy of their data first
      </label>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={typedId} className={LABEL}>
          Type {user.email} to confirm
        </label>
        <input
          id={typedId}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className={INPUT}
        />
      </div>
      {step === "reauth" ? (
        <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <legend className="px-1 text-[14px] font-medium text-text">Confirm it’s you</legend>
          <p className="text-[13px] text-text-secondary leading-5">
            Deleting an account needs a fresh check. Enter your password and a 2-step code.
          </p>
          <input
            type="password"
            aria-label="Your password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-autofocus
            className={INPUT}
          />
          <input
            aria-label="2-step code"
            placeholder="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={INPUT}
          />
        </fieldset>
      ) : null}
      <ModalNote icon={PATHS.shield}>
        Super admin only. Logged in the audit log. This can’t be undone.
      </ModalNote>
      <ErrorLine>{error}</ErrorLine>
    </Modal>
  );
}
