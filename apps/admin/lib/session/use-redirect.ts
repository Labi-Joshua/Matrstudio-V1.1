"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeFor } from "../nav/menu";
import { safeNext } from "../nav/routes";
import { getMe } from "./api";

/** The `next` query parameter of the current URL, or null. Read in the browser only. */
export const readNext = (): string | null =>
  new URLSearchParams(window.location.search).get("next");

/**
 * On the sign-in screens: an admin who already has a session goes straight to the portal (to
 * `next` when it is a same-site path, otherwise to the first page their role may open).
 */
export function useRedirectIfSignedIn() {
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    getMe(controller.signal).then((result) => {
      if (controller.signal.aborted || !result.ok) return;
      const next = readNext();
      router.replace(next ? safeNext(next) : homeFor(result.data));
    });
    return () => controller.abort();
  }, [router]);
}

const EMAIL_KEY = "matr-admin-2step-email";

/** The email shown on the 2-step screen ("code for ada@example.com"). Display only, never a credential. */
export function rememberEmail(email: string): void {
  try {
    sessionStorage.setItem(EMAIL_KEY, email);
  } catch {
    // Private mode: the screen falls back to generic wording.
  }
}
export function recalledEmail(): string | null {
  try {
    return sessionStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}
