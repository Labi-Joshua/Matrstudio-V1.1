import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ConfirmEmail,
  ConfirmEmailFallback,
} from "../../../../components/app-settings/confirm-email";
import { ROUTES } from "../../../../lib/routes";
import { pageMeta } from "../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Confirm your new email | Matr Studio",
    description: "Confirm the new email address for your Matr Studio account.",
    path: ROUTES.settingsConfirmEmail,
  }),
  robots: { index: false, follow: false },
};

export default function ConfirmEmailPage() {
  // useSearchParams (inside the screen) needs a Suspense boundary in a static export.
  return (
    <Suspense fallback={<ConfirmEmailFallback />}>
      <ConfirmEmail />
    </Suspense>
  );
}
