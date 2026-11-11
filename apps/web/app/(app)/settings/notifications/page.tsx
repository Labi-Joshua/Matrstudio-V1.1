import type { Metadata } from "next";
import { NotificationsSection } from "../../../../components/app-settings/notifications-section";
import { ROUTES } from "../../../../lib/routes";
import { pageMeta } from "../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Notification settings | Matr Studio",
    description: "Choose what Matr Studio tells you, in the app and by email.",
    path: ROUTES.settingsNotifications,
  }),
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <NotificationsSection />;
}
