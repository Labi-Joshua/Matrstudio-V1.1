"use client";

import type { Ref } from "react";
import type { SendFailureCopy } from "../../lib/app/help-requests";
import { Banner, bannerActionClasses, StatusRegion } from "../auth/banner";
import { TURNSTILE_CONFIGURED, Turnstile, type TurnstileHandle } from "../auth/turnstile";
import type { TicketSend } from "./use-ticket-send";

/**
 * The failure banner above a form (Figma "didn't send" 671:76627: the reason, what was kept and
 * Retry) inside an assertive status region, so it is announced. `onRetry` is absent when another
 * try cannot help (a closed request).
 */
export function SendFailure({
  status,
  onRetry,
  maxWidth,
}: {
  status: TicketSend;
  onRetry: () => void;
  maxWidth: string;
}) {
  const copy: SendFailureCopy | null = status.state === "failed" ? status.copy : null;
  return (
    <StatusRegion politeness="assertive">
      {copy ? (
        <div className={maxWidth}>
          <Banner
            tone={copy.captcha ? "warning" : "error"}
            title={copy.title}
            action={
              copy.retry ? (
                <button type="button" onClick={onRetry} className={bannerActionClasses}>
                  Retry
                </button>
              ) : undefined
            }
          >
            {copy.description}
          </Banner>
        </div>
      ) : null}
    </StatusRegion>
  );
}

/** The Turnstile check, same as the Submit form: nothing is drawn when no key is configured. */
export function CaptchaBlock({
  captchaRef,
  onToken,
}: {
  captchaRef: Ref<TurnstileHandle>;
  onToken: (token: string | null) => void;
}) {
  if (!TURNSTILE_CONFIGURED) return null;
  return (
    <div className="max-w-full overflow-x-auto">
      <Turnstile ref={captchaRef} onToken={onToken} />
    </div>
  );
}
