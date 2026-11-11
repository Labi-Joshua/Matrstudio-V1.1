import type { Metadata } from "next";
import { LearningSection } from "../../../../components/app-settings/learning-section";
import { ROUTES } from "../../../../lib/routes";
import { pageMeta } from "../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Learning preferences | Matr Studio",
    description: "Your interests, experience level and weekly goal.",
    path: ROUTES.settingsLearning,
  }),
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <LearningSection />;
}
