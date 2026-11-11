"use client";

import { useCallback, useRef, useState } from "react";
import { type SendFailureCopy, type SendNoun, sendFailureCopy } from "../../lib/app/help-requests";
import { createTicket, type NewTicket, type Ticket } from "../../lib/auth/support-api";
import { TURNSTILE_CONFIGURED, type TurnstileHandle } from "../auth/turnstile";

/**
 * Sending a support message or report (Figma "sending" 671:76273, "didn't send" 671:76627):
 * idle, sending, sent with the created ticket, or failed with copy for the real error code. The
 * Turnstile token is single use, so the widget is reset after every attempt; when the key is
 * configured and the learner has not done the check yet, nothing is sent and the screen shows
 * the "one quick check" copy (the same as the API's captcha_required).
 */
export type TicketSend =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "sent"; ticket: Ticket }
  | { state: "failed"; copy: SendFailureCopy };

export function useTicketSend(noun: SendNoun) {
  const [status, setStatus] = useState<TicketSend>({ state: "idle" });
  const [token, setToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  const inFlight = useRef(false);

  const send = useCallback(
    async (input: NewTicket) => {
      if (inFlight.current) return;
      if (TURNSTILE_CONFIGURED && !token) {
        setStatus({
          state: "failed",
          copy: sendFailureCopy({ ok: false, code: "captcha_required", message: "" }, noun),
        });
        return;
      }
      inFlight.current = true;
      setStatus({ state: "sending" });
      const result = await createTicket({ ...input, captchaToken: token });
      captcha.current?.reset();
      setToken(null);
      inFlight.current = false;
      setStatus(
        result.ok
          ? { state: "sent", ticket: result.data }
          : { state: "failed", copy: sendFailureCopy(result, noun) },
      );
    },
    [token, noun],
  );

  const clear = useCallback(() => setStatus({ state: "idle" }), []);

  return { status, send, clear, captcha, setToken };
}
