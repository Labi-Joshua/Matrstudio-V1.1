import { Geist, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { pageMeta, SITE_NAME, SITE_URL } from "../lib/site";
import { themeInitScript } from "../lib/theme";
import "./globals.css";

// Self-hosted at build time by next/font, so the static export makes no requests to Google.
// Fonts mirror the waitlist; confirm against the V3 landing frames when the Figma file is readable.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata = {
  metadataBase: new URL(SITE_URL),
  ...pageMeta({
    title: `${SITE_NAME} | Free learning paths for designers and developers`,
    description:
      "Matr Studio turns the best free resources on the web into step-by-step learning paths for designers and developers.",
    path: "/",
  }),
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
