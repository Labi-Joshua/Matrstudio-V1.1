"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { parseRequestId, requestHref } from "../../lib/app/help-requests";

/**
 * Notifications created by support actions link to /learn/help?ticket=<id>. The site is a static
 * export, so the hub reads the parameter in the browser and sends the learner to that request.
 */
export function TicketRedirect() {
  const router = useRouter();
  useEffect(() => {
    const id = parseRequestId(
      `?id=${new URLSearchParams(window.location.search).get("ticket") ?? ""}`,
    );
    if (id) router.replace(requestHref(id));
  }, [router]);
  return null;
}
