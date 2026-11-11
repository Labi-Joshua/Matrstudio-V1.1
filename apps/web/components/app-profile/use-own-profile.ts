"use client";

import { useCallback, useEffect, useState } from "react";
import { PROFILE_CHANGE_EVENT } from "../../lib/app/avatar-store";
import { getOwnProfile, type OwnProfile } from "../../lib/auth/profile-api";

export type OwnProfileState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; profile: OwnProfile };

/** The signed-in learner's profile: loads on mount, `set` swaps in what the API returned after a save. */
export function useOwnProfile() {
  const [state, setState] = useState<OwnProfileState>({ status: "loading" });
  const [reloads, setReloads] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloads` re-runs the load on purpose
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    getOwnProfile(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState(result.ok ? { status: "ready", profile: result.data } : { status: "error" });
    });
    return () => controller.abort();
  }, [reloads]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const set = useCallback((profile: OwnProfile) => {
    setState({ status: "ready", profile });
    // The shell avatar (top bar, menu) re-reads the photo.
    window.dispatchEvent(new Event(PROFILE_CHANGE_EVENT));
  }, []);
  return { state, reload, set };
}
