"use client";

import { useState } from "react";
import { remindBatch, sendInvites } from "../../lib/people/api";
import { plural } from "../../lib/people/format";
import type { Batch } from "../../lib/people/types";
import { Modal, ModalNote } from "./modal";
import { failureToast, useToast } from "./toast";
import { BTN_PRIMARY, BTN_SECONDARY, PATHS } from "./ui";

function Preview({ subject, children }: { subject: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-bg-fill1 p-4 text-[14px] leading-5 tracking-[-0.14px]">
      <p className="text-[12px] text-text-tertiary">Email preview</p>
      <p className="font-medium text-text">Subject: {subject}</p>
      {children}
    </div>
  );
}

const CTA =
  "inline-flex h-9 w-fit items-center rounded-lg bg-text px-3 font-medium text-[14px] text-bg-base";

/** Send invites (Figma US8 and the "didn't send" error toast). */
export function InviteModal({
  count,
  rangeLine,
  onClose,
  onSent,
}: {
  count: number;
  rangeLine: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const r = await sendInvites(count);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      toast(
        failureToast(
          "Invites didn’t send",
          `${r.message} Nothing was sent. Try again in a moment.`,
        ),
      );
      return;
    }
    toast({
      tone: "success",
      title: `${plural(r.data.sent, "invite")} sent`,
      body: "We’ll track who creates an account and confirms.",
    });
    onSent();
    onClose();
  }

  return (
    <Modal
      title={`Invite ${count.toLocaleString("en-GB")} ${count === 1 ? "person" : "people"}`}
      subtitle={rangeLine}
      icon={PATHS.mail}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={busy || count < 1}
            data-autofocus
            className={BTN_PRIMARY}
          >
            {busy ? "Sending…" : `Send ${plural(count, "invite")}`}
          </button>
        </>
      }
    >
      <Preview subject="You’re in: your Matr Studio invite">
        <p>Hi there, thanks for waiting. Your spot is ready.</p>
        <p className="text-text-secondary">
          Create your account to start a free learning path in UI/UX, brand or product design.
        </p>
        <span className={CTA}>Create your account</span>
      </Preview>
      <p className="text-[13px] text-text-secondary leading-5 tracking-[-0.13px]">
        Invite links work for 14 days. Anyone who hasn’t joined after 7 days gets one reminder.
      </p>
      {error ? (
        <p role="alert" className="text-[14px] text-error-text leading-5">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

/** Remind people who haven't joined (Figma US10). One reminder per batch. */
export function RemindModal({
  batch,
  onClose,
  onSent,
}: {
  batch: Batch;
  onClose: () => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = batch.notJoined;

  async function send() {
    setBusy(true);
    setError(null);
    const r = await remindBatch(batch.id);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      toast(failureToast("Reminders didn’t send", `${r.message} Nothing was sent.`));
      return;
    }
    toast({
      tone: "success",
      title: `Reminder sent to ${plural(r.data.reminded, "person", "people")}`,
      body: "This was the only reminder for this batch.",
    });
    onSent();
    onClose();
  }

  return (
    <Modal
      title={`Remind ${plural(n, "person", "people")}?`}
      subtitle="They were invited more than 7 days ago and haven’t created an account."
      icon={PATHS.mail}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={busy || n < 1}
            data-autofocus
            className={BTN_PRIMARY}
          >
            {busy ? "Sending…" : "Send reminder"}
          </button>
        </>
      }
    >
      <Preview subject="Your Matr Studio invite is still waiting">
        <p>Hi there, your invite to Matr Studio is still open. It works for a few more days.</p>
        <span className={CTA}>Create your account</span>
      </Preview>
      <ModalNote icon={PATHS.clock}>
        This is the only reminder. After that, the invite just expires.
      </ModalNote>
      {error ? (
        <p role="alert" className="text-[14px] text-error-text leading-5">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
