import { Geist, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { ReferralCapture } from "../components/referral-capture";
import { analyticsInitScript, GA_ID } from "../lib/analytics";
import { HOME_DESCRIPTION, HOME_TITLE, pageMeta, SITE_NAME, SITE_URL } from "../lib/site";
import { themeInitScript } from "../lib/theme";
import "./globals.css";

// Self-hosted at build time by next/font, so the static export makes no requests to Google.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata = {
  // Resolves relative canonical/OG URLs; every host (www, vercel.app) points search engines here.
  metadataBase: new URL(SITE_URL),
  ...pageMeta({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/" }),
};

// Structured data: tells Google what this site is. No logo or social profiles listed until real
// ones exist; sameAs must only list accounts we actually run.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      description: HOME_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: HOME_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};
// "<" is escaped so the JSON can never close the script tag early.
const ldJson = JSON.stringify(structuredData).replace(/</g, "\\u003c");

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme is set by the inline script before hydration, so React must not flag the mismatch.
    <html lang="en" className={`${geist.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party theme script */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Google Analytics: consent defaults + config inline first, then gtag.js. In the static
            HTML (as in Google's snippet) so Google's tag checker finds it; async, so it never
            blocks rendering. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party analytics bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: analyticsInitScript }} />
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD, "<" escaped above */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson }} />
      </head>
      <body>
        {children}
        <ReferralCapture />
      </body>
    </html>
  );
}
