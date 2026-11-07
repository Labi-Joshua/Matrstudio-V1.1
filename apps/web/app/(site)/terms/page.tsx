import { LegalPage } from "../../../components/pages/company/legal-page";
import { TERMS_TILES } from "../../../lib/pages/company-tiles";
import { TERMS } from "../../../lib/pages/legal-docs";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata = pageMeta({
  title: "Terms of Service | Matr Studio",
  description:
    "The terms for using matrstudio.com and the Matr Studio waitlist during pre-launch: joining, referrals, acceptable use and more.",
  path: ROUTES.terms,
});

// Figma "Marketing pages (V3)": Page · Terms of Service 780:10524.
export default function TermsPage() {
  return <LegalPage doc={TERMS} tiles={TERMS_TILES} />;
}
