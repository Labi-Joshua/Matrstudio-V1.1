"use client";

import { useEffect, useState } from "react";
import { reportLinkMailto } from "../../lib/app/detail-state";
import type { LibraryItem } from "../../lib/app/library-data";
import { useSession } from "../app/session";
import { FOCUS } from "../app/ui";
import { Banner, ToastRegion } from "../auth/banner";

const TOAST_MS = 8000;

function FlagIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 22V4M4 4h13l-2 4.5 2 4.5H4" />
    </svg>
  );
}

/**
 * "Report a broken link" (Figma "Resource: link reported"): one tap, then a toast and the link
 * reads as reported. There is no support API, so the tap opens the email app with the report
 * ready (reportLinkMailto) and the toast says exactly that: nothing is sent until the learner
 * presses send. TODO(support-api): post the report and show a real confirmation.
 */
export function ReportLink({ item }: { item: LibraryItem }) {
  const { me } = useSession();
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState(false);
  const hasLink = item.url !== "";

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function report() {
    window.location.href = reportLinkMailto(item, me.email);
    setDone(true);
    setToast(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={report}
        disabled={done || !hasLink}
        title={hasLink ? undefined : "Sample content has no link to report"}
        className={`inline-flex h-10 items-center justify-center gap-1.5 self-center rounded-lg px-2 text-[14px] leading-5 tracking-[-0.14px] md:self-auto ${
          done || !hasLink
            ? "cursor-default text-text-tertiary"
            : `text-text-secondary hover:text-text ${FOCUS}`
        }`}
      >
        <FlagIcon />
        {done ? "Report drafted in email" : "Report a broken link"}
      </button>
      <ToastRegion>
        {toast ? (
          <Banner
            tone="success"
            title="Your report is ready to send"
            onDismiss={() => setToast(false)}
          >
            We opened your email app with the report ready. Our curators check it once you press
            send; nothing reaches us before that.
          </Banner>
        ) : null}
      </ToastRegion>
    </>
  );
}
