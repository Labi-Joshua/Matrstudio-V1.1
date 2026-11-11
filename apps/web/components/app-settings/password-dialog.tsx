"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import {
  formOutcome,
  hasErrors,
  type PasswordErrors,
  validatePasswordChange,
} from "../../lib/app/settings-forms";
import { changePassword, setPassword } from "../../lib/auth/account-api";
import { PASSWORD_MIN_LENGTH } from "../../lib/auth/validation";
import { useSession } from "../app/session";
import { Banner, StatusRegion } from "../auth/banner";
import { Button } from "../auth/button";
import { PasswordField } from "../auth/field";
import { EyeIcon } from "../auth/icons";
import { Modal } from "./modal";

/**
 * "Change password" for an account with a password (current one first, as the design says), and
 * "Set a password" for a Google-only account (needs a recent sign-in). Other sessions are signed
 * out when it succeeds.
 */
export function PasswordDialog({
  hasPassword,
  onClose,
  onDone,
}: {
  hasPassword: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { signOut, signingOut } = useSession();
  const formId = useId();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [banner, setBanner] = useState<{ title: string; message: string } | null>(null);
  const [signInAgain, setSignInAgain] = useState(false);
  const [pending, setPending] = useState(false);
  const refs = {
    current: useRef<HTMLInputElement>(null),
    next: useRef<HTMLInputElement>(null),
    confirm: useRef<HTMLInputElement>(null),
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const found = validatePasswordChange(form, hasPassword);
    setErrors(found);
    setBanner(null);
    if (hasErrors(found)) {
      (found.current ? refs.current : found.next ? refs.next : refs.confirm).current?.focus();
      return;
    }
    setPending(true);
    const result = hasPassword
      ? await changePassword({ currentPassword: form.current, newPassword: form.next })
      : await setPassword(form.next);
    setPending(false);
    if (result.ok) {
      onDone();
      return;
    }
    const outcome = formOutcome(result, hasPassword ? "password" : "set-password", false);
    if (outcome.kind === "reauth") setSignInAgain(true);
    else if (outcome.kind === "field") {
      setErrors({ [outcome.field === "current" ? "current" : "next"]: outcome.message });
      (outcome.field === "current" ? refs.current : refs.next).current?.focus();
    } else setBanner({ title: outcome.title, message: outcome.message });
  }

  const title = hasPassword ? "Change password" : "Set a password";
  return (
    <Modal
      title={title}
      subtitle={`Use at least ${PASSWORD_MIN_LENGTH} characters.`}
      icon={<EyeIcon size={24} />}
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="md:w-auto">
            Cancel
          </Button>
          {signInAgain ? (
            <Button
              onClick={signOut}
              pending={signingOut}
              pendingLabel="Signing out"
              className="md:w-auto"
            >
              Sign out and sign in again
            </Button>
          ) : (
            <Button
              type="submit"
              form={formId}
              pending={pending}
              pendingLabel="Saving"
              className="md:w-auto"
            >
              {title}
            </Button>
          )}
        </>
      }
    >
      <StatusRegion>
        {banner ? (
          <Banner tone="error" title={banner.title}>
            {banner.message}
          </Banner>
        ) : null}
        {signInAgain ? (
          <Banner tone="warning" title="Sign in again first">
            For your security this needs a recent sign-in. Sign out, sign back in, then try again.
          </Banner>
        ) : null}
      </StatusRegion>
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        {hasPassword ? (
          <PasswordField
            ref={refs.current}
            label="Current password"
            name="current-password"
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })}
            error={errors.current}
          />
        ) : null}
        <PasswordField
          ref={refs.next}
          label="New password"
          name="new-password"
          autoComplete="new-password"
          value={form.next}
          disabled={signInAgain}
          onChange={(e) => setForm({ ...form, next: e.target.value })}
          error={errors.next}
          hint={errors.next ? undefined : `At least ${PASSWORD_MIN_LENGTH} characters.`}
        />
        <PasswordField
          ref={refs.confirm}
          label="Confirm new password"
          name="confirm-password"
          autoComplete="new-password"
          value={form.confirm}
          disabled={signInAgain}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          error={errors.confirm}
        />
      </form>
    </Modal>
  );
}
