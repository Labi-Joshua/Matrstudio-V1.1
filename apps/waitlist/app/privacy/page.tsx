import { LegalPage } from "../../components/legal/legal-page";
import { PRIVACY } from "../../content/legal";
import { pageMeta } from "../../lib/site";

export const metadata = pageMeta({
  title: `${PRIVACY.title} | Matr Studio`,
  description: PRIVACY.description,
  path: "/privacy",
});

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} />;
}
