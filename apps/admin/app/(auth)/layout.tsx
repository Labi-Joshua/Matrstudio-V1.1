import type { ReactNode } from "react";
import { AuthFrame } from "../../components/shell/auth-frame";
import { ThemeInit } from "../../components/ui/theme";

export const metadata = {
  title: "Sign in | Matr Studio admin",
  robots: { index: false, follow: false },
};

/** Sign-in, 2-step and invite screens: no sidebar, centred card on the peach background. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ThemeInit />
      <AuthFrame>{children}</AuthFrame>
    </>
  );
}
