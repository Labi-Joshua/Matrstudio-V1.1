"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { DELETE_PHRASE, isDeletePhrase, loseSummary } from "../../lib/app/settings-delete";
import { formOutcome } from "../../lib/app/settings-forms";
import { type AccountSummary, deleteAccount } from "../../lib/auth/account-api";
import { ROUTES } from "../../lib/routes";
import { useSession } from "../app/session";
import { Banner, StatusRegion } from "../auth/banner";
import { Button } from "../auth/button";
import { PasswordField, TextField } from "../auth/field";
import { CircleAlertIcon } from "../auth/icons";
import { Modal } from "./modal";

/**
 * Delete account (Figma "Settings: delete account", dialog on desktop and tablet, full-screen
 * sheet on phones): says what is lost, asks for DELETE to be typed, and deletes. When the session
 * is older than 5 minutes the API asks to confirm it is you: a password field appears (or, for
 * an account with no password, a prompt to sign in again).
 */
export function DeleteDialog({
  account,
  onClose,
}: {
  account: AccountSummary;
  onClose: () => void;
}) {
  const router = useRouter();
  const { signOut, signingOut } = useSession();
  const formId = useId();
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [signInAgain, setSignInAgain] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ title: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const ready = isDeletePhrase(phrase) && (!needsPassword || password.length > 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !ready) return;
    setBanner(null);
    setPasswordError(null);
    setPending(true);
    const result = await deleteAccount(needsPassword ? password : undefined);
    if (result.ok) {
      // The session is gone with the account; leave without a flash of the app.
      router.replace(ROUTES.home);
      return;
    }
    setPending(false);
    const outcome = formOutcome(result, "delete", needsPassword);
    if (outcome.kind === "reauth") {
      if (account.hasPassword) {
        setNeedsPassword(true);
        setBanner({
          title: "Confirm it’s you",
          message: "Enter your password to delete your account.",
        });
        requestAnimationFrame(() => passwordRef.current?.focus());
      } else setSignInAgain(true);
    } else if (outcome.kind === "field") {
      setPasswordError(outcome.message);
      passwordRef.current?.focus();
    } else setBanner({ title: outcome.title, message: outcome.message });
  }

  return (
    <Modal
      title="Delete your account?"
      subtitle="This can’t be undone."
      icon={<CircleAlertIcon size={24} />}
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="hidden md:inline-flex md:w-auto">
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
              inactive={!ready}
              pending={pending}
              pendingLabel="Deleting"
              className="!bg-error-text md:w-auto"
            >
              Delete account
            </Button>
          )}
        </>
      }
    >
      <StatusRegion politeness="assertive">
        {banner ? (
          <Banner tone="warning" title={banner.title}>
            {banner.message}
          </Banner>
        ) : null}
        {signInAgain ? (
          <Banner tone="warning" title="Sign in again first">
            For your security, deleting your account needs a recent sign-in. Sign out, sign back in,
            then try again.
          </Banner>
        ) : null}
      </StatusRegion>
      <div className="flex items-start gap-2 rounded-xl bg-error-focus p-3 text-error-text">
        <span className="mt-0.5 shrink-0">
          <CircleAlertIcon />
        </span>
        <div className="text-[14px] leading-5 tracking-[-0.14px]">
          <p className="font-medium text-text">You’ll lose</p>
          <p className="text-text-secondary">{loseSummary(account.counts)}</p>
        </div>
      </div>
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label={`Type ${DELETE_PHRASE} to confirm`}
          name="confirm-delete"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={phrase}
          disabled={signInAgain}
          onChange={(e) => setPhrase(e.target.value)}
        />
        {needsPassword ? (
          <PasswordField
            ref={passwordRef}
            label="Your password"
            name="current-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(null);
            }}
            error={passwordError}
          />
        ) : null}
      </form>
    </Modal>
  );
}
