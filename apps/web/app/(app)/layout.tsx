import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "../../components/app/shell";

/**
 * Signed-in learner app (Figma "Navigation and notification"): no marketing nav or footer. The
 * shell checks the session in the browser (static export), so this layout is a thin wrapper.
 * Nothing in here belongs in search results.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
