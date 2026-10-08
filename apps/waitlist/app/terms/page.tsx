import { LegalPage } from "../../components/legal/legal-page";
import { TERMS } from "../../content/legal";

export const metadata = {
  title: `${TERMS.title} | Matr Studio`,
  description: TERMS.description,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <LegalPage doc={TERMS} />;
}
