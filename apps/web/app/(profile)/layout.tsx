import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer } from "../../components/landing/footer";
import { Nav } from "../../components/landing/nav";

/**
 * Public profile pages: the marketing header and footer, no app shell, readable signed out. The
 * page is a static shell whose content is loaded in the browser, so it carries no indexable
 * content and is marked noindex (a private profile must never be indexed).
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PublicProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
    </>
  );
}
