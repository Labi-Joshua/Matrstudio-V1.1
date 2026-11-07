import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailConfirmed, EmailConfirmedFallback } from "../../../components/auth/email-confirmed";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Confirm your email | Matr Studio",
    description: "Confirm your email address to finish creating your Matr Studio account.",
    path: ROUTES.emailConfirmed,
  }),
  robots: { index: false, follow: false },
};

export default function EmailConfirmedPage() {
  // useSearchParams (inside the screen) needs a Suspense boundary in a static export.
  return (
    <Suspense fallback={<EmailConfirmedFallback />}>
      <EmailConfirmed />
    </Suspense>
  );
}
