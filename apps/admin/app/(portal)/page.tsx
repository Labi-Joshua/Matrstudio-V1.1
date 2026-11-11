"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ADMIN_ROUTES } from "../../lib/nav/routes";

/** "/" opens the dashboard (owned by the dashboard screens). */
export default function PortalIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(ADMIN_ROUTES.dashboard);
  }, [router]);
  return <h1 className="sr-only">Opening the dashboard</h1>;
}
