import { Geist, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { SITE_URL } from "../lib/site";
import { themeInitScript } from "../lib/theme";
import "./globals.css";

// Self-hosted at build time by next/font, so the static export makes no requests to Google.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata = {
  // Resolves relative canonical/OG URLs; every host (www, vercel.app) points search engines here.
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  title: "Matr Studio: join the waitlist",
  description:
    "The collaborative learning hub and community for product designers. Self-paced learning paths, active chat rooms, and peer-contributed resources.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme is set by the inline script before hydration, so React must not flag the mismatch.
    <html lang="en" className={`${geist.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party theme script */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
