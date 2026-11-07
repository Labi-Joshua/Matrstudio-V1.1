"use client";

import { useRef, useState } from "react";
import { sendVerificationEmail } from "../../lib/auth/api";
import { authErrorCopy, formatWait } from "../../lib/auth/messages";
import {
  RESEND_COOLDOWN_SECONDS,
  type ResendOutcome,
  resendOutcome,
} from "../../lib/auth/sign-up-state";
import { formatCountdown, useCountdown } from "../../lib/auth/use-countdown";
import { Banner, ToastRegion } from "./banner";
import { ButtonLink, TextButton } from "./button";
import { MailIcon } from "./icons";
import { AuthHeader, AuthScreen, IconTile } from "./shell";
import { Turnstile, type TurnstileHandle } from "./turnstile";

/**
 * "Check your inbox" (Figma 7) with the resend limit state (Figma 8). Shown after a successful
 * create account. The email lives in this component's props only (memory), never in storage or
 * the URL. A 60 second cooldown starts right away because the sign up call just sent a message;
 * the API's own rate limit (retryAfterSeconds) replaces it when it answers 429.
 */
export function CheckInbox({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const [cooldown, setCooldown] = useState<number | null>(RESEND_COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);
  const [capped, setCapped] = useState(false);
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ResendOutcome | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  const secondsLeft = useCountdown(cooldown, () => setCooldown(null));

  async function resend() {
    if (sending || capped || cooldown !== null) return;
    setSending(true);
    setOutcome(null);
    const result = await sendVerificationEmail({ email, captchaToken });
    if (needsCaptcha) captcha.current?.reset(); // a Turnstile token is single use
    setSending(false);
    const next = resendOutcome(result);
    setOutcome(next);
    if (next.kind === "sent") setCooldown(RESEND_COOLDOWN_SECONDS);
    else if (next.kind === "wait") setCooldown(next.seconds);
    else if (next.kind === "limit_reached") setCapped(true);
    else if (next.kind === "needs_captcha") setNeedsCaptcha(true);
  }

  const waiting = cooldown !== null;

  return (
    <AuthScreen>
      <ToastRegion politeness={outcome?.kind === "sent" ? "polite" : "assertive"}>
        {outcome ? (
          <ResendToast
            outcome={outcome}
            email={email}
            onDismiss={() => setOutcome(null)}
            onRetry={resend}
          />
        ) : null}
      </ToastRegion>

      <AuthHeader
        focusTitle
        icon={
          <IconTile tone="primary">
            <MailIcon size={24} />
          </IconTile>
        }
        title="Check your inbox"
        description={`We sent a confirmation link to ${email}. Open it to activate your account.`}
      />

      <ButtonLink href="mailto:">Open email app</ButtonLink>

      {needsCaptcha ? <Turnstile ref={captcha} onToken={setCaptchaToken} /> : null}

      <div className="flex flex-col gap-4 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        <p>
          Didn’t get the email?{" "}
          {capped ? (
            <span className="text-text-tertiary">Resending is paused for now</span>
          ) : waiting ? (
            <span className="text-text-tertiary">Resend in {formatCountdown(secondsLeft)}</span>
          ) : (
            <TextButton onClick={resend} aria-busy={sending || undefined} disabled={sending}>
              {sending ? "Sending…" : "Resend email"}
            </TextButton>
          )}
        </p>
        <p>
          Wrong email? <TextButton onClick={onChangeEmail}>Change it</TextButton>
        </p>
      </div>
    </AuthScreen>
  );
}

export function ResendToast({
  outcome,
  email,
  onDismiss,
  onRetry,
}: {
  outcome: ResendOutcome;
  email: string;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  switch (outcome.kind) {
    case "sent":
      return (
        <Banner tone="success" title="Email sent" onDismiss={onDismiss}>
          We sent a new link to {email}.
        </Banner>
      );
    case "wait":
      return (
        <Banner tone="warning" title="Please wait before resending" onDismiss={onDismiss}>
          You can request another email in {formatWait(outcome.seconds)}.
        </Banner>
      );
    case "limit_reached": {
      const copy = authErrorCopy({ ok: false, code: "resend_limit_reached", message: "" });
      return (
        <Banner tone="warning" title={copy.title} onDismiss={onDismiss}>
          {copy.description}
        </Banner>
      );
    }
    case "needs_captcha": {
      const copy = authErrorCopy({ ok: false, code: outcome.code, message: "" });
      return (
        <Banner tone="warning" title={copy.title} onDismiss={onDismiss}>
          {copy.description}
        </Banner>
      );
    }
    case "network": {
      const copy = authErrorCopy({ ok: false, code: "network_error", message: "" });
      return (
        <Banner tone="error" title={copy.title} onDismiss={onDismiss}>
          {copy.description}{" "}
          <TextButton onClick={onRetry} className="text-[14px] leading-5">
            Try again
          </TextButton>
        </Banner>
      );
    }
    case "failed":
      return (
        <Banner tone="error" title="We couldn’t send it" onDismiss={onDismiss}>
          Something went wrong. Try again in a moment.
        </Banner>
      );
  }
}
