import { JetBrains_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { Reveal } from "../components/reveal";
import { pageMeta, SITE_NAME, SITE_URL } from "../lib/site";
import { themeInitScript } from "../lib/theme";
import "./globals.css";

// Self-hosted at build time by next/font, so the static export makes no requests to Google.
// The V3 frames use Manrope throughout (Regular for body, Medium for headings and buttons).
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
// Small uppercase labels and stat chips (path counts, hours) use the mono face in the design.
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

const DESCRIPTION =
  "Matr Studio turns the best free resources on the web into step-by-step learning paths for designers and developers.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  ...pageMeta({
    title: `${SITE_NAME} | Free learning paths for designers and developers`,
    description: DESCRIPTION,
    path: "/",
  }),
};

// Structured data: tells Google what this site is. sameAs must only list accounts we actually run,
// so it is left out until real profiles exist.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: ["matrstudio", "Matr"],
      url: SITE_URL,
      description: DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: ["matrstudio", "Matr"],
      description: DESCRIPTION,
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
    <html
      lang="en"
      className={`${manrope.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party theme script */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD, "<" escaped above */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson }} />
      </head>
      <body>
        {children}
        <Reveal />
      </body>
    </html>
  );
}
