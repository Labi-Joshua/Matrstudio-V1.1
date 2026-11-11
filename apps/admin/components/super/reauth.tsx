"use client";

import { cn } from "@matr/ui";
import { useCallback, useRef, useState } from "react";
import { type ApiResult, adminRequest } from "../../lib/api";
import { parseNothing } from "../../lib/super/parse";
import { ShieldIcon } from "./icons";
import { InlineError, Modal, ModalFooter } from "./modal";
import { Field, FOCUS, INPUT } from "./ui";

/**
 * Fresh-auth prompt (backend: requireFreshAuth, 300 s). A thin local wrapper around
 * POST /api/admin/reauth { password, code }, used until the shell's session helper lands.
 *
 * `run(fn)` calls an action; if the API answers 401 `reauth_required` it shows the prompt, and on a
 * successful re-auth runs the action once more. Cancelling resolves with the original failure.
 */
export function useReauth() {
  const [open, setOpen] = useState(false);
  const waiting = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        waiting.current = resolve;
        setOpen(true);
      }),
    [],
  );
  const settle = useCallback((ok: boolean) => {
    setOpen(false);
    waiting.current?.(ok);
    waiting.current = null;
  }, []);

  const run = useCallback(
    async <T,>(action: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> => {
      const first = await action();
      if (first.ok || first.code !== "reauth_required") return first;
      if (!(await ask())) return first;
      return action();
    },
    [ask],
  );

  return { run, dialog: open ? <ReauthDialog onDone={settle} /> : null };
}

export function ReauthDialog({ onDone }: { onDone: (ok: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    if (!password || code.trim().length < 6) {
      setError("Enter your password and your 6-digit code.");
      return;
    }
    setBusy(true);
    setError(undefined);
    const result = await adminRequest("POST", "/reauth", parseNothing, {
      body: { password, code: code.trim() },
    });
    setBusy(false);
    if (result.ok) {
      onDone(true);
      return;
    }
    setPassword("");
    setError(
      result.code === "reauth_failed"
        ? "That didn’t match. Check your password and code."
        : result.message,
    );
  };

  return (
    <Modal
      icon={<ShieldIcon />}
      title="Confirm it’s you"
      subtitle="This change needs your password and a fresh 2-step code."
      onClose={() => onDone(false)}
      busy={busy}
      onSubmit={submit}
      footer={
        <ModalFooter
          onCancel={() => onDone(false)}
          confirmLabel="Confirm"
          busyLabel="Checking…"
          busy={busy}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Password" htmlFor="reauth-password">
          <input
            id="reauth-password"
            data-autofocus
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(INPUT, FOCUS)}
          />
        </Field>
        <Field
          label="2-step code"
          htmlFor="reauth-code"
          hint="6 digits from your authenticator app, or a backup code."
        >
          <input
            id="reauth-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={16}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={cn(INPUT, FOCUS, "font-mono tracking-[2px]")}
          />
        </Field>
        <InlineError>{error}</InlineError>
      </div>
    </Modal>
  );
}
