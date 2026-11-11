"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { TicketPage } from "./support-detail";
import { SupportInbox } from "./support-list";
import { ToastProvider } from "./toast";

/** /support shows the inbox; /support?id=… shows one request (static export: detail by query). */
export function SupportPage() {
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <Switch />
      </Suspense>
    </ToastProvider>
  );
}

function Switch() {
  const id = useSearchParams().get("id");
  return id ? <TicketPage key={id} id={id} /> : <SupportInbox />;
}
