"use client";

import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { type Me, signOut } from "../../lib/auth/api";
import { ROUTES } from "../../lib/routes";

/**
 * The signed-in learner for everything inside the app shell. The shell only renders its children
 * once /api/me has answered 200, so `me` is never null here.
 */
type SessionValue = {
  me: Me;
  /** Sign out: POST /api/auth/sign-out, then replace the page with /sign-in. */
  signOut: () => Promise<void>;
  signingOut: boolean;
  /** Set when the sign-out request failed (offline, API down); the session is still active. */
  signOutError: string | null;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ me, children }: { me: Me; children: ReactNode }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    const result = await signOut();
    // 401 means there is no session left to end, which is what we wanted.
    if (result.ok || result.code === "unauthorized") {
      router.replace(ROUTES.signIn);
      return;
    }
    setSigningOut(false);
    setSignOutError("We couldn’t sign you out. Check your connection and try again.");
  }, [router, signingOut]);

  const value = useMemo(
    () => ({ me, signOut: run, signingOut, signOutError }),
    [me, run, signingOut, signOutError],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside the app shell");
  return value;
}
