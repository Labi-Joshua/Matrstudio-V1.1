import type { Metadata } from "next";
import { ProfileScreen } from "../../../components/app-profile/profile-screen";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Profile | Matr Studio",
    description: "Your profile on Matr Studio.",
    path: ROUTES.profile,
  }),
  robots: { index: false, follow: false },
};

/** Figma "Profile and settings": your view, edit profile and make it public. See ProfileScreen. */
export default function ProfilePage() {
  return <ProfileScreen />;
}
