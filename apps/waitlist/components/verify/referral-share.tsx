"use client";

import { useEffect, useState } from "react";
import { normaliseCode, referralLink } from "../../lib/referral";
import { asset } from "../landing/primitives";
import { primaryButton } from "./buttons";

/**
 * "Your referral link" card on the confirmed pages. The API redirects there with the person's own
 * code (?code=...); renders nothing if it is missing or malformed.
 */
export function ReferralShare() {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const code = normaliseCode(new URLSearchParams(window.location.search).get("code"));
    if (code) setLink(referralLink(code));
  }, []);

  if (!link) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the field is selectable, so it can be copied by hand.
    }
  }

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-3 rounded-2xl border border-border-soft bg-bg-fill1 p-4">
      <div className="flex flex-col gap-1 text-center">
        <p className="font-semibold text-base text-text leading-6 tracking-[-0.16px]">
          Your referral link
        </p>
        <p className="text-sm text-text-secondary leading-5 tracking-[-0.14px]">
          Share it with friends who’d love Matr Studio.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={link}
          aria-label="Your referral link"
          onFocus={(event) => event.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-full border border-border-soft bg-bg-base px-4 font-medium text-sm text-text leading-5 tracking-[-0.14px] outline-none focus:border-primary-border"
        />
        <button type="button" onClick={copy} className={primaryButton}>
          <img alt="" src={asset("verify-copy.svg")} width={20} height={20} className="size-5" />
          <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
        </button>
      </div>
    </div>
  );
}
