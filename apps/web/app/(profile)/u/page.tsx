import type { Metadata } from "next";
import { PublicProfileView } from "../../../components/app-profile/public-view";

export const metadata: Metadata = {
  title: "Profile | Matr Studio",
  description: "A learner profile on Matr Studio.",
  robots: { index: false, follow: false },
};

/** /u?name=ada, and /@ada through the Worker rewrite (worker/profile-path.ts). */
export default function PublicProfilePage() {
  return <PublicProfileView />;
}
