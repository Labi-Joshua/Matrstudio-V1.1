import { LegalPage } from "../../../components/pages/company/legal-page";
import { PRIVACY_TILES } from "../../../lib/pages/company-tiles";
import { PRIVACY } from "../../../lib/pages/legal-docs";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata = pageMeta({
  title: "Privacy Policy | Matr Studio",
  description:
    "What personal information Matr Studio collects during pre-launch, why we collect it, who we share it with, and the choices you have.",
  path: ROUTES.privacy,
});

// Figma "Marketing pages (V3)": Page · Privacy Policy 780:11046.
export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} tiles={PRIVACY_TILES} />;
}
