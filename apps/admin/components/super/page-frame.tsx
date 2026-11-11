"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "./toast";

/**
 * Wraps a Super admin page: toasts plus the page padding. The shell builder's
 * `app/(portal)/layout.tsx` supplies the sidebar and top bar; if it also pads the body, drop the
 * padding classes here (this is the only place they live).
 */
export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-6 px-4 py-6 md:px-8 xl:px-10">
        {children}
      </div>
    </ToastProvider>
  );
}
