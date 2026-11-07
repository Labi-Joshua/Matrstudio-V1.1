import type { ReactNode } from "react";
import { Footer } from "../../components/landing/footer";
import { Nav } from "../../components/landing/nav";

/** Every marketing page shares the same nav and footer. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
    </>
  );
}
