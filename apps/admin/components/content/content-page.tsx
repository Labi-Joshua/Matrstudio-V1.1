"use client";

import { type ReactNode, Suspense } from "react";
import { ToastProvider } from "./toast";

/** Every content route renders inside this: toasts, and the Suspense that useSearchParams needs. */
export function ContentPage({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <Suspense fallback={null}>{children}</Suspense>
    </ToastProvider>
  );
}
