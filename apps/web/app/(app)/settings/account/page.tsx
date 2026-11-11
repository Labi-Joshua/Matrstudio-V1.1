import type { Metadata } from "next";
import { AccountSection } from "../../../../components/app-settings/account-section";
import { ROUTES } from "../../../../lib/routes";
import { pageMeta } from "../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Account settings | Matr Studio",
    description: "Your email, password, sign-in methods and account.",
    path: ROUTES.settingsAccount,
  }),
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <AccountSection />;
}
