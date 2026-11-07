import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ResetPasswordFallback,
  ResetPasswordForm,
} from "../../../components/auth/reset-password-form";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Set a new password | Matr Studio",
    description: "Choose a new password for your Matr Studio account.",
    path: ROUTES.resetPassword,
  }),
  // The URL carries a one-time token: never indexed, and no referrer leaves the page.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  // useSearchParams (inside the form) needs a Suspense boundary in a static export.
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
