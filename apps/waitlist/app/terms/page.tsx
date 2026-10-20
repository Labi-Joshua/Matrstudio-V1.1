import { LegalPage } from "../../components/legal/legal-page";
import { TERMS } from "../../content/legal";
import { pageMeta } from "../../lib/site";

export const metadata = pageMeta({
  title: `${TERMS.title} | Matr Studio`,
  description: TERMS.description,
  path: "/terms",
});

export default function TermsPage() {
  return <LegalPage doc={TERMS} />;
}
