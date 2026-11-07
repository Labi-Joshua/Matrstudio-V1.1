import type { Metadata } from "next";
import { Dashboard } from "../../../components/app/dashboard";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Home | Matr Studio",
    description: "Your learning paths and picks on Matr Studio.",
    path: ROUTES.dashboard,
  }),
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <Dashboard />;
}
