import type { Metadata } from "next";
import { AppearanceSection } from "../../../../components/app-settings/appearance-section";
import { ROUTES } from "../../../../lib/routes";
import { pageMeta } from "../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Appearance and privacy | Matr Studio",
    description: "Theme, public profile and your data.",
    path: ROUTES.settingsAppearance,
  }),
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <AppearanceSection />;
}
