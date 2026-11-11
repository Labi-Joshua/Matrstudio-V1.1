import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "../../components/app/shell";
import { SavedProvider } from "../../components/app-saved/saved-provider";

/**
 * Signed-in learner app (Figma "Navigation and notification"): no marketing nav or footer. The
 * shell checks the session in the browser (static export), so this layout is a thin wrapper; the
 * saved-resources provider sits inside it, so it only loads once the learner is signed in.
 * Nothing in here belongs in search results.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <SavedProvider>{children}</SavedProvider>
    </AppShell>
  );
}
