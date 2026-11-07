import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteScreen } from "../../../components/auth/invite-screen";
import { ResetPasswordFallback } from "../../../components/auth/reset-password-form";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Your spot is ready | Matr Studio",
    description: "Create your Matr Studio account from your waitlist invite.",
    path: ROUTES.invite,
  }),
  // The URL carries a one-time invite token: never indexed, and no referrer leaves the page.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function InvitePage() {
  // useSearchParams (inside the screen) needs a Suspense boundary in a static export.
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <InviteScreen />
    </Suspense>
  );
}
