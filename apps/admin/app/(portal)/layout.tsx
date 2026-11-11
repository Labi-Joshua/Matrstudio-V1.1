import type { ReactNode } from "react";
import { PortalShell } from "../../components/shell/portal-shell";
import { ThemeInit } from "../../components/ui/theme";

/** Every portal page runs inside the admin shell (sidebar, top bar, session gate). */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ThemeInit />
      <PortalShell>{children}</PortalShell>
    </>
  );
}
