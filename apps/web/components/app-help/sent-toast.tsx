"use client";

import { useEffect, useState } from "react";
import { Banner, ToastRegion } from "../auth/banner";

const TOAST_MS = 6000;

const COPY = {
  support: { title: "Message sent", body: "We’ll reply by email within 2 working days." },
  report: { title: "Report sent", body: "Thanks for telling us. We’ll look into it." },
} as const;

/**
 * The success toast on the hub after a send (Figma Help centre toast): the sent screen's "Back to
 * Help centre" opens /learn/help?sent=support|report. The flag is read once in the browser,
 * removed from the address bar, and the toast dismisses itself after a few seconds.
 */
export function SentToast() {
  const [sent, setSent] = useState<keyof typeof COPY | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const value = url.searchParams.get("sent");
    if (value !== "support" && value !== "report") return;
    setSent(value);
    url.searchParams.delete("sent");
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => setSent(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [sent]);

  return (
    <ToastRegion>
      {sent ? (
        <Banner tone="success" title={COPY[sent].title} onDismiss={() => setSent(null)}>
          {COPY[sent].body}
        </Banner>
      ) : null}
    </ToastRegion>
  );
}
