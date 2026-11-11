"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROUTES } from "../../lib/routes";

/** Static export has no server redirects: replace the history entry once the page loads. */
export function RedirectToAccount() {
  const router = useRouter();
  useEffect(() => {
    router.replace(ROUTES.settingsAccount);
  }, [router]);
  return <p className="sr-only">Opening your account settings</p>;
}
