"use client";

import { useCallback, useEffect, useState } from "react";
import { sortTickets } from "../../lib/app/help-requests";
import { listTickets, type Ticket } from "../../lib/auth/support-api";

export type TicketsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; tickets: Ticket[] };

/** The learner's requests (GET /api/me/support), newest activity first, with a retry. */
export function useTickets() {
  const [state, setState] = useState<TicketsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the load on Retry
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    listTickets(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState(
        result.ok ? { status: "ready", tickets: sortTickets(result.data) } : { status: "error" },
      );
    });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
