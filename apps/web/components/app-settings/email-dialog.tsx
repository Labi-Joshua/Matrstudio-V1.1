"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import {
  type EmailErrors,
  formOutcome,
  hasErrors,
  validateEmailChange,
} from "../../lib/app/settings-forms";
import { requestEmailChange } from "../../lib/auth/account-api";
import { normaliseEmail } from "../../lib/auth/validation";
import { useSession } from "../app/session";
import { Banner, StatusRegion } from "../auth/banner";
import { Button } from "../auth/button";
import { PasswordField, TextField } from "../auth/field";
import { MailIcon } from "../auth/icons";
import { Modal } from "./modal";

/**
 * "Change email" dialog. The new address gets a link; nothing changes until it is opened. When
 * the session is older than 5 minutes the API asks for the password (or, for an account with no
 * password, to sign in again).
 */
export function EmailDialog({
  hasPassword,
  onClose,
  onSent,
}: {
  hasPassword: boolean;
  onClose: () => void;
  onSent: (email: string) => void;
}) {
  const { me, signOut, signingOut } = useSession();
  const formId = useId();
  const [form, setForm] = useState({ newEmail: "", password: "" });
  const [errors, setErrors] = useState<EmailErrors>({});
  const [needsPassword, setNeedsPassword] = useState(false);
  const [signInAgain, setSignInAgain] = useState(false);
  const [banner, setBanner] = useState<{ title: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const found = validateEmailChange(form, me.email, needsPassword);
    setErrors(found);
    setBanner(null);
    if (hasErrors(found)) {
      (found.newEmail ? emailRef : passwordRef).current?.focus();
      return;
    }
    setPending(true);
    const result = await requestEmailChange({
      newEmail: normaliseEmail(form.newEmail),
      ...(needsPassword ? { password: form.password } : {}),
    });
    setPending(false);
    if (result.ok) {
      onSent(result.data);
      return;
    }
    const outcome = formOutcome(result, "email", needsPassword);
    if (outcome.kind === "reauth") {
      if (hasPassword) {
        setNeedsPassword(true);
        setBanner({
          title: "Confirm it’s you",
          message: "Enter your current password to change your email.",
        });
        requestAnimationFrame(() => passwordRef.current?.focus());
      } else setSignInAgain(true);
    } else if (outcome.kind === "field") {
      setErrors({ password: outcome.message });
      passwordRef.current?.focus();
    } else setBanner({ title: outcome.title, message: outcome.message });
  }

  return (
    <Modal
      title="Change email"
      subtitle="We’ll send a link to the new address."
      icon={<MailIcon size={24} />}
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
              pendingLabel="Sending link"
              className="md:w-auto"
            >
              Send link
            </Button>
          )}
        </>
      }
    >
      <StatusRegion>
        {banner ? (
          <Banner tone="warning" title={banner.title}>
            {banner.message}
          </Banner>
        ) : null}
        {signInAgain ? (
          <Banner tone="warning" title="Sign in again first">
            For your security, changing your email needs a recent sign-in. Sign out, sign back in,
            then try again.
          </Banner>
        ) : null}
      </StatusRegion>
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          Your email is {me.email}. Your email changes once you open the link we send to the new
          address, and you’ll be signed out everywhere.
        </p>
        <TextField
          ref={emailRef}
          label="New email"
          type="email"
          name="new-email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          value={form.newEmail}
          disabled={signInAgain}
          onChange={(e) => setForm({ ...form, newEmail: e.target.value })}
          error={errors.newEmail}
        />
        {needsPassword ? (
          <PasswordField
            ref={passwordRef}
            label="Current password"
            name="current-password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
          />
        ) : null}
      </form>
    </Modal>
  );
}
