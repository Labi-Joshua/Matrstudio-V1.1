"use client";

import { useCallback, useEffect, useState } from "react";
import { listSubmissions, type Submission } from "../../lib/auth/submissions-api";
import type { SubmissionsState } from "./my-submissions";

/**
 * The learner's submissions, shared by the full page and the dialog. Loads on mount (or once
 * `enabled` turns true); `added` puts a just-sent submission at the top and refreshes in the
 * background.
 */
export function useSubmissions(enabled = true) {
  const [list, setList] = useState<SubmissionsState>({ status: "loading" });
  const [reloads, setReloads] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloads` re-runs the load on purpose
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setList((current) => (current.status === "ready" ? current : { status: "loading" }));
    listSubmissions(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setList(result.ok ? { status: "ready", rows: result.data } : { status: "error" });
    });
    return () => controller.abort();
  }, [enabled, reloads]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const added = useCallback((submission: Submission) => {
    setList((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            rows: [submission, ...current.rows.filter((row) => row.id !== submission.id)],
          }
        : current,
    );
    setReloads((n) => n + 1);
  }, []);

  return { list, reload, added };
}
