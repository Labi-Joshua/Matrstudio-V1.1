"use client";

import { ApiClientError } from "@matr/api-client";
import { useState } from "react";
import { api } from "../../lib/api";
import { asset } from "../landing/primitives";
import { primaryButton, secondaryButton } from "./buttons";

type State = "idle" | "sending" | "sent" | "error";

/**
 * Actions on the link-expired page. The API redirects here with the expired token in the query
 * string; "Send a new link" posts it back, and the API emails a fresh link to the address it was
 * issued for. "Use a different email" goes to the signup form on the homepage.
 */
export function ResendLinkActions() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  async function resend() {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("error");
      setMessage("This link is incomplete. Use a different email to get a new one.");
      return;
    }
    setState("sending");
    try {
      await api.waitlist.resend({ token });
      setState("sent");
    } catch (err) {
      setState("error");
      setMessage(
        err instanceof ApiClientError && err.code === "rate_limited"
          ? "Too many attempts. Please wait a minute."
          : "We couldn’t send a new link. Use a different email to get one.",
      );
    }
  }

  if (state === "sent") {
    return (
      <p
        role="status"
        className="rounded-full border border-border-soft bg-bg-fill1 px-4 py-2.5 text-center font-medium text-sm text-text tracking-[-0.14px]"
      >
        A new link is on its way. Check your inbox.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={resend}
          disabled={state === "sending"}
          className={primaryButton}
        >
          <img
            alt=""
            src={asset("verify-refresh-cw.svg")}
            width={20}
            height={20}
            className={state === "sending" ? "size-5 animate-spin" : "size-5"}
          />
          {state === "sending" ? "Sending…" : "Send a new link"}
        </button>
        <a href="/#join" className={secondaryButton}>
          Use a different email
        </a>
      </div>
      {state === "error" && (
        <p role="alert" className="px-4 text-center text-[13px] text-primary">
          {message}
        </p>
      )}
    </div>
  );
}
