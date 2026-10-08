import { LegalPage } from "../../components/legal/legal-page";
import { PRIVACY } from "../../content/legal";

export const metadata = {
  title: `${PRIVACY.title} | Matr Studio`,
  description: PRIVACY.description,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} />;
}
