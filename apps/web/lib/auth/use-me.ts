"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { type ApiFailure, type ApiResult, getMe, type Me } from "./api";
import { postAuthPath } from "./paths";

/**
 * Who is signed in, for a static export: everything runs in the browser after load, so the first
 * state is always "loading". "unauthenticated" means the API said 401; "error" means we could not
 * tell (offline, API down), which screens treat like "show the normal page".
 */
export type MeState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; me: Me }
  | { status: "error"; failure: ApiFailure };

/** Pure mapping from an API result to a MeState (exported for tests). */
export function meStateFromResult(result: ApiResult<Me>): MeState {
  if (result.ok) return { status: "authenticated", me: result.data };
  if (result.code === "unauthorized") return { status: "unauthenticated" };
  return { status: "error", failure: result };
}

/** Fetches /api/me once on mount. `refresh()` fetches again (after sign in or sign out). */
export function useMe(): { state: MeState; refresh: () => void } {
  const [state, setState] = useState<MeState>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: nonce re-runs the fetch on refresh()
  useEffect(() => {
    const controller = new AbortController();
    getMe(controller.signal).then((result) => {
      if (!controller.signal.aborted) setState(meStateFromResult(result));
    });
    return () => controller.abort();
  }, [nonce]);

  const refresh = useCallback(() => {
    setState({ status: "loading" });
    setNonce((n) => n + 1);
  }, []);

  return { state, refresh };
}

/**
 * For pages that make no sense once signed in (sign in, forgot password): replaces the page with
 * onboarding or the dashboard when a session exists. Returns the state so the page can keep
 * rendering its form meanwhile.
 */
export function useRedirectIfAuthenticated(): MeState {
  const router = useRouter();
  const { state } = useMe();
  useEffect(() => {
    if (state.status === "authenticated") router.replace(postAuthPath(state.me));
  }, [state, router]);
  return state;
}

/** After a successful sign in: reads /api/me and goes to onboarding or the dashboard. */
export function useGoAfterSignIn(): () => Promise<void> {
  const router = useRouter();
  return useCallback(async () => {
    const result = await getMe();
    router.replace(postAuthPath(result.ok ? result.data : null));
  }, [router]);
}
