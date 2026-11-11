"use client";

import { getReviewer } from "../../lib/review/api";
import { useLoad } from "./hooks";

/**
 * The signed-in admin. `canManage` is review_queues:manage; until /me answers it is false, so the
 * decision buttons stay disabled rather than appearing and failing with 403.
 */
export function useReviewer() {
  const { state } = useLoad("reviewer", (signal) => getReviewer(signal));
  return state.status === "ready"
    ? { ready: true, meId: state.data.id, canManage: state.data.canManage }
    : { ready: false, meId: null as string | null, canManage: false };
}
