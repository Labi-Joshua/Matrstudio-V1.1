"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * TODO(support-api): "sending" today is handing a mailto: link to the email app, which the page
 * cannot observe. The state machine is shaped like a real request (idle, sending, sent, failed) so
 * the screens do not change when the support API replaces it. "failed" only happens when the
 * browser refuses to follow the link; the sending state is held briefly so it is never a flash.
 */
export type SendState = "idle" | "sending" | "sent" | "failed";

const SENDING_MIN_MS = 600;

export function useMailtoSend(): {
  state: SendState;
  href: string | null;
  send: (href: string) => void;
  reset: () => void;
} {
  const [state, setState] = useState<SendState>("idle");
  const [href, setHref] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const send = useCallback((target: string) => {
    window.clearTimeout(timer.current);
    setHref(target);
    setState("sending");
    try {
      window.location.href = target;
    } catch {
      setState("failed");
      return;
    }
    timer.current = window.setTimeout(() => setState("sent"), SENDING_MIN_MS);
  }, []);

  const reset = useCallback(() => {
    window.clearTimeout(timer.current);
    setState("idle");
  }, []);

  return { state, href, send, reset };
}
