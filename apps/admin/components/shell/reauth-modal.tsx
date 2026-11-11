"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { reauth } from "../../lib/session/api";
import { isBackupCode, isSixDigits, problemFrom } from "../../lib/session/auth-copy";
import { toSignIn, useSessionInternals } from "../../lib/session/provider";
import { Button, TextButton } from "../ui/button";
import { CodeInput, PasswordField, TextField } from "../ui/field";
import { LockIcon } from "../ui/icons";
import { Modal } from "../ui/modal";

/**
 * Re-auth (300 s fresh-auth): shown when an action needs a recent confirmation. Password plus a
 * 6-digit code (or a backup code), POST /api/admin/reauth. Wrong details keep the modal open; a
 * paused account ends the session (the API signs it out), so the admin goes back to sign-in.
 */
export function ReauthModal() {
  const router = useRouter();
  const { reauthOpen, finishReauth } = useSessionInternals();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reauthOpen) return null;

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (pending) return;
    const codeOk = backup ? isBackupCode(code) : isSixDigits(code);
    if (!password || !codeOk) {
      setError(
        backup
          ? "Enter your password and a backup code."
          : "Enter your password and the 6-digit code.",
      );
      return;
    }
    setPending(true);
    setError(null);
    const result = await reauth(password, code.trim());
    setPending(false);
    if (result.ok) {
      setPassword("");
      setCode("");
      finishReauth(true, result.data);
      return;
    }
    const problem = problemFrom(result);
    if (problem.kind === "paused") {
      finishReauth(false);
      router.replace(toSignIn("paused"));
      return;
    }
    if (problem.kind === "session") {
      finishReauth(false);
      router.replace(toSignIn("expired"));
      return;
    }
    setCode("");
    setError(
      problem.kind === "wrong" || problem.kind === "offline"
        ? problem.message
        : "Something went wrong. Try again.",
    );
  }

  function cancel() {
    setPassword("");
    setCode("");
    setError(null);
    finishReauth(false);
  }

  return (
    <Modal
      title="Confirm it’s you"
      subtitle="This change needs a recent check. Enter your password and a 2-step code."
      icon={<LockIcon size={20} />}
      width={480}
      onClose={cancel}
      dismissible={!pending}
      footer={
        <>
          <Button variant="secondary" onClick={cancel} inactive={pending}>
            Cancel
          </Button>
          <Button pending={pending} pendingLabel="Checking" onClick={() => submit()}>
            Confirm
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={Boolean(error)}
          disabled={pending}
        />
        {backup ? (
          <TextField
            label="Backup code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            error={error}
            disabled={pending}
          />
        ) : (
          <CodeInput
            label="6-digit code"
            value={code}
            onChange={setCode}
            error={error}
            disabled={pending}
          />
        )}
        <p className="text-[13px] text-text-secondary leading-[18px]">
          {backup ? "Each backup code works once. " : "Lost your device? "}
          <TextButton
            onClick={() => {
              setBackup((b) => !b);
              setCode("");
              setError(null);
            }}
          >
            {backup ? "Use the app code instead" : "Use a backup code"}
          </TextButton>
        </p>
        {/* Enter submits from any field. */}
        <button type="submit" className="sr-only" tabIndex={-1}>
          Confirm
        </button>
      </form>
    </Modal>
  );
}
