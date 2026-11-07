import type { Metadata } from "next";
import { OnboardingFlow } from "../../../components/onboarding/onboarding-flow";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Set up your learning | Matr Studio",
    description: "Tell us your goal, level and topics and we’ll suggest a learning path.",
    path: ROUTES.onboarding,
  }),
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
