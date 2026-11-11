"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiFailure, ApiResult } from "../../lib/api";
import { isAlreadyReviewed, nextSubmissionHref } from "../../lib/review/advance";
import { useToast } from "./toast";

type Outcome = { nextId: string | null };

/**
 * Runs one decision on a submission (approve, request a change, decline). On success it shows
 * `success`, then opens the next waiting submission. A 409 means somebody else got there first:
 * the "Already reviewed" toast, then the next item (or the queue) opens.
 */
export function useDecision(submissionId: string) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(
    call: () => Promise<ApiResult<Outcome>>,
    success: { title: string; body?: string },
    onConflict?: () => void,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    const result = await call();
    if (result.ok) {
      const next = await nextSubmissionHref(submissionId, result.data.nextId);
      toast({
        tone: "success",
        ...success,
        body: next.opened ? `${success.body ?? ""} Opening the next one.`.trim() : success.body,
      });
      router.push(next.href);
      return true;
    }
    setBusy(false);
    if (isAlreadyReviewed(result)) {
      onConflict?.();
      const next = await nextSubmissionHref(submissionId);
      toast({
        tone: "warning",
        title: "Already reviewed",
        body: `${result.message} ${next.opened ? "We’ve opened the next one." : "The queue is clear."}`,
      });
      router.push(next.href);
      return false;
    }
    setError(messageFor(result));
    return false;
  }
  return { run, busy, error, clearError: () => setError(null) };
}

export function messageFor(f: ApiFailure): string {
  if (f.code === "network_error")
    return "We couldn’t reach the server. Check your connection and try again.";
  if (f.code === "forbidden") return "Your role can’t make this change.";
  if (f.code === "rate_limited") return "Too many requests. Wait a moment and try again.";
  return f.message && f.message !== "Something went wrong."
    ? f.message
    : "That didn’t go through. Nothing was changed.";
}
