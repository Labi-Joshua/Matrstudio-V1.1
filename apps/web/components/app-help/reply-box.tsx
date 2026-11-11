"use client";

import { type FormEvent, useRef, useState } from "react";
import { MESSAGE_MAX } from "../../lib/app/help-form";
import { type SendFailureCopy, sendFailureCopy } from "../../lib/app/help-requests";
import { replyToTicket, type Ticket } from "../../lib/auth/support-api";
import { Button } from "../auth/button";
import { TextAreaField } from "./fields";
import { SendFailure } from "./send-parts";

/**
 * The follow-up box of the request page (Figma "Reply" 485:45291): POST /api/me/support/:id/messages.
 * Replies are text only and need no Turnstile (the contract only asks for it on creating a
 * request). A 409 ticket_closed means support closed the request meanwhile: `onClosed` reloads it.
 */
export function ReplyBox({
  ticketId,
  onSent,
  onClosed,
}: {
  ticketId: string;
  onSent: (ticket: Ticket) => void;
  onClosed: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<SendFailureCopy | null>(null);
  const [sending, setSending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (sending) return;
    const message = text.trim();
    if (message.length === 0) {
      setError("Write a reply first.");
      return field.current?.focus();
    }
    if (message.length > MESSAGE_MAX) {
      setError(`Keep this under ${MESSAGE_MAX} characters.`);
      return field.current?.focus();
    }
    setFailure(null);
    setSending(true);
    const result = await replyToTicket(ticketId, message);
    setSending(false);
    if (result.ok) {
      setText("");
      onSent(result.data);
      return;
    }
    if (result.code === "ticket_closed") return onClosed();
    setFailure(sendFailureCopy(result, "reply"));
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={sending || undefined}
      className="flex w-full flex-col gap-3"
    >
      <TextAreaField
        ref={field}
        label="Reply"
        name="reply"
        rows={4}
        max={MESSAGE_MAX}
        placeholder="Write a reply…"
        value={text}
        error={error}
        readOnly={sending}
        onChange={(e) => {
          setText(e.target.value);
          setError(undefined);
        }}
      />
      <SendFailure
        status={failure ? { state: "failed", copy: failure } : { state: "idle" }}
        onRetry={() => submit()}
        maxWidth=""
      />
      <div className="flex sm:justify-end">
        <div className="w-full sm:w-fit">
          <Button type="submit" pending={sending} pendingLabel="Sending…">
            Send reply
          </Button>
        </div>
      </div>
    </form>
  );
}
