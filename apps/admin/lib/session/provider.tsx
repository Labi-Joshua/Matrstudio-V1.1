"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ApiFailure, ApiResult } from "../api";
import { ADMIN_ROUTES } from "../nav/routes";
import { getMe, signOutRequest } from "./api";
import { FRESH_AUTH_MARGIN_SECONDS, FRESH_AUTH_SECONDS, idleState } from "./idle";
import type { AdminMe } from "./types";

/**
 * The admin session (GET /api/admin/me), the one place the portal learns who is signed in:
 * - unauthorised (401) sends the admin to /sign-in?next=<page>; a failed or offline /me shows a
 *   retry panel instead of guessing;
 * - `me.permissions` and `me.menu` drive the role-aware menu and page gates;
 * - idle handling: activity refreshes the session quietly before it lapses, otherwise a
 *   "Still there?" warning shows two minutes before the end and the session then expires;
 * - re-auth (300 s fresh-auth): see useReauth().
 */
export type SessionState =
  | { status: "loading" }
  | { status: "authenticated"; me: AdminMe }
  | { status: "unauthenticated" }
  | { status: "error"; failure: ApiFailure };

type ReauthWaiter = (ok: boolean) => void;

type SessionApi = {
  state: SessionState;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  signingOut: boolean;
  signOutError: string | null;
  /** Seconds until the idle timeout when a warning is due, else null. */
  idleWarning: number | null;
  stayActive: () => Promise<void>;
  /** Call with any failed ApiResult: a 401 "unauthorized" ends the session. Returns true if handled. */
  handleFailure: (failure: ApiFailure) => boolean;
  reauthOpen: boolean;
  /** Resolves true once the admin has confirmed (or was already fresh), false if they cancel. */
  requestReauth: () => Promise<boolean>;
  finishReauth: (ok: boolean, at?: number) => void;
  isFresh: () => boolean;
};

const SessionContext = createContext<SessionApi | null>(null);

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function toSignIn(reason?: "expired" | "paused"): string {
  const params = new URLSearchParams();
  const here = currentPath();
  if (!here.startsWith("/sign-in") && here !== "/" && !here.startsWith("/accept-invite")) {
    params.set("next", here);
  }
  if (reason) params.set("reason", reason);
  const query = params.toString();
  return query ? `${ADMIN_ROUTES.signIn}?${query}` : ADMIN_ROUTES.signIn;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [idleWarning, setIdleWarning] = useState<number | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const waiters = useRef<ReauthWaiter[]>([]);
  const lastReauth = useRef<number | null>(null);
  const lastActivity = useRef(Date.now());
  const meRef = useRef<AdminMe | null>(null);
  const lastRefreshAt = useRef(0);

  const apply = useCallback((result: ApiResult<AdminMe>) => {
    if (result.ok) {
      meRef.current = result.data;
      lastReauth.current = result.data.lastReauthAt;
      setState({ status: "authenticated", me: result.data });
    } else if (result.code === "unauthorized" || result.status === 401) {
      meRef.current = null;
      setState({ status: "unauthenticated" });
    } else {
      // Keep a signed-in view on a hiccup during a background refresh; show the retry panel on first load.
      setState((now) =>
        now.status === "authenticated" ? now : { status: "error", failure: result },
      );
    }
  }, []);

  const refresh = useCallback(async () => {
    apply(await getMe());
  }, [apply]);

  useEffect(() => {
    const controller = new AbortController();
    getMe(controller.signal).then((r) => {
      if (!controller.signal.aborted) apply(r);
    });
    return () => controller.abort();
  }, [apply]);

  useEffect(() => {
    if (state.status === "unauthenticated")
      router.replace(toSignIn(meRef.current ? "expired" : undefined));
  }, [state.status, router]);

  // Activity tracking and the idle clock.
  useEffect(() => {
    if (state.status !== "authenticated") return;
    const mark = () => {
      lastActivity.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    for (const e of events) window.addEventListener(e, mark, { passive: true });
    const tick = async () => {
      const me = meRef.current;
      if (!me) return;
      const s = idleState(me, Date.now() / 1000, (Date.now() - lastActivity.current) / 1000);
      if (s.kind === "expired") {
        setIdleWarning(null);
        setState({ status: "unauthenticated" });
      } else if (s.kind === "refresh" && Date.now() - lastRefreshAt.current > 30000) {
        lastRefreshAt.current = Date.now();
        setIdleWarning(null);
        await refresh();
      } else if (s.kind === "warn") setIdleWarning(s.secondsLeft);
      else if (s.kind === "refresh")
        setIdleWarning(Math.ceil(me.sessionExpiresAt - Date.now() / 1000));
      else setIdleWarning(null);
    };
    const timer = setInterval(tick, 5000);
    // Coming back to the tab: check right away (the session may have ended meanwhile).
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      for (const e of events) window.removeEventListener(e, mark);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state.status, refresh]);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    setSignOutError(null);
    const result = await signOutRequest();
    if (!result.ok && result.code === "network_error") {
      setSigningOut(false);
      setSignOutError("We couldn’t sign you out. Check your connection and try again.");
      return;
    }
    meRef.current = null;
    router.replace(ADMIN_ROUTES.signIn);
  }, [router]);

  const stayActive = useCallback(async () => {
    lastActivity.current = Date.now();
    setIdleWarning(null);
    await refresh();
  }, [refresh]);

  const handleFailure = useCallback((failure: ApiFailure) => {
    if (failure.status === 401 && failure.code === "unauthorized") {
      setState({ status: "unauthenticated" });
      return true;
    }
    return false;
  }, []);

  const isFresh = useCallback(() => {
    const at = lastReauth.current;
    return at !== null && Date.now() / 1000 - at <= FRESH_AUTH_SECONDS - FRESH_AUTH_MARGIN_SECONDS;
  }, []);

  const requestReauth = useCallback(
    () =>
      isFresh()
        ? Promise.resolve(true)
        : new Promise<boolean>((resolve) => {
            waiters.current.push(resolve);
            setReauthOpen(true);
          }),
    [isFresh],
  );

  const finishReauth = useCallback((ok: boolean, at?: number) => {
    if (ok) lastReauth.current = at ?? Math.floor(Date.now() / 1000);
    setReauthOpen(false);
    const pending = waiters.current;
    waiters.current = [];
    for (const resolve of pending) resolve(ok);
  }, []);

  const api = useMemo<SessionApi>(
    () => ({
      state,
      refresh,
      signOut,
      signingOut,
      signOutError,
      idleWarning,
      stayActive,
      handleFailure,
      reauthOpen,
      requestReauth,
      finishReauth,
      isFresh,
    }),
    [
      state,
      refresh,
      signOut,
      signingOut,
      signOutError,
      idleWarning,
      stayActive,
      handleFailure,
      reauthOpen,
      requestReauth,
      finishReauth,
      isFresh,
    ],
  );
  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

function useSessionApi(): SessionApi {
  const api = useContext(SessionContext);
  if (!api) throw new Error("useAdminSession must be used inside <SessionProvider>");
  return api;
}

/** The signed-in admin and session actions. Only valid below the portal layout (always signed in). */
export function useAdminSession() {
  const api = useSessionApi();
  if (api.state.status !== "authenticated")
    throw new Error("useAdminSession outside a signed-in view");
  return { ...api, me: api.state.me };
}

export const useSessionInternals = useSessionApi;

/**
 * Fresh-auth (300 s) for sensitive actions (invite or remove an admin, change roles). Screens call
 *   const { runWithReauth } = useReauth();
 *   const result = await runWithReauth(() => adminRequest("POST", "/team/invite", parse, { body }));
 * The call runs; if the API answers 401 reauth_required the re-auth modal opens (password + 2-step
 * code, POST /reauth) and the call is retried once on success. A cancelled modal returns the
 * original failure. `ensureFresh()` opens the modal up front when the last confirmation is old.
 */
export function useReauth() {
  const { requestReauth, handleFailure } = useSessionApi();
  const runWithReauth = useCallback(
    async <T,>(call: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> => {
      const first = await call();
      if (first.ok) return first;
      if (first.code === "reauth_required") {
        if (!(await requestReauth())) return first;
        const second = await call();
        if (!second.ok) handleFailure(second);
        return second;
      }
      handleFailure(first);
      return first;
    },
    [requestReauth, handleFailure],
  );
  return { runWithReauth, ensureFresh: requestReauth };
}
