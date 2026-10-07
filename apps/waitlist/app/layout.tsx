import { Geist, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Self-hosted at build time by next/font, so the static export makes no requests to Google.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata = {
  title: "Matr Studio: join the waitlist",
  description:
    "The collaborative learning hub and community for product designers. Self-paced learning paths, active chat rooms, and peer-contributed resources.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
