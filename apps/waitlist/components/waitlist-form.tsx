"use client";

import { ApiClientError } from "@matr/api-client";
import { cn } from "@matr/ui";
import { type FormEvent, useState } from "react";
import { api } from "../lib/api";

type State = "idle" | "submitting" | "done" | "error";

type WaitlistFormProps = {
  referralCode?: string;
  /** "ink": black button (hero). "primary": orange button (community section). */
  variant?: "ink" | "primary";
  /** Recorded in the signup metadata so we can tell which form converted. */
  source?: string;
  /** Overrides the default input id (email-<source>) when the source can change. */
  inputId?: string;
  /** Let the email field fill the available width instead of the design's fixed 280px. */
  fluid?: boolean;
  /** Button text, and the text while submitting. */
  submitLabel?: string;
  pendingLabel?: string;
  className?: string;
};

export function WaitlistForm({
  referralCode,
  variant = "ink",
  source = "waitlist-site",
  fluid = false,
  submitLabel = "Join the Waitlist",
  pendingLabel = "Joining…",
  inputId,
  className,
}: WaitlistFormProps) {
  const emailId = inputId ?? `email-${source}`;
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setState("submitting");
    try {
      await api.waitlist.join({ email, referralCode, metadata: { source } });
      setState("done");
    } catch (err) {
      setState("error");
      setMessage(
        err instanceof ApiClientError && err.code === "rate_limited"
          ? "Too many attempts. Please wait a minute."
          : "Could not join the waitlist. Check your email and try again.",
      );
    }
  }

  if (state === "done") {
    return (
      <p
        role="status"
        className={cn(
          "rounded-full border border-border-soft bg-bg-fill1 px-4 py-2.5 font-medium text-sm text-text tracking-[-0.14px]",
          className,
        )}
      >
        Check your inbox to confirm your spot.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <form
        onSubmit={onSubmit}
        className={cn(
          "flex w-full max-w-[425px] items-stretch gap-2",
          variant === "primary" && "p-0.5",
        )}
      >
        <label htmlFor={emailId} className="sr-only">
          Email address
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          placeholder="Enter your email address"
          autoComplete="email"
          className={cn(
            "h-10 min-w-0 flex-1 rounded-full border border-border-soft bg-bg-base px-4 font-medium text-sm text-text leading-5 tracking-[-0.14px] outline-none transition-colors duration-500 ease-smooth placeholder:text-text-secondary focus:border-primary-border",
            !fluid && "sm:w-[280px] sm:flex-none",
          )}
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-2.5 font-medium text-sm text-white leading-5 tracking-[-0.14px] transition-all duration-500 ease-smooth hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(214,92,31,0.7)] active:translate-y-0 active:scale-[0.97] disabled:translate-y-0 disabled:opacity-60",
            variant === "ink" ? "bg-[#060606] dark:bg-primary" : "bg-primary",
          )}
        >
          {state === "submitting" ? pendingLabel : submitLabel}
        </button>
      </form>
      {state === "error" && (
        <p role="alert" className="px-4 text-[13px] text-primary">
          {message}
        </p>
      )}
    </div>
  );
}
