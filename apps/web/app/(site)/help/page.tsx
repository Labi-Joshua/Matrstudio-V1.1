import {
  HelpContact,
  HelpEmail,
  HelpHero,
  HelpReport,
} from "../../../components/pages/company/help-sections";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata = pageMeta({
  title: "Help centre | Matr Studio",
  description:
    "Contact Matr Studio support or report a problem such as a broken page, a dead link or outdated content. We reply by email within 2 working days.",
  path: ROUTES.help,
});

// Figma "Marketing pages (V3)": Page · Help centre 778:8561.
export default function HelpPage() {
  return (
    <main>
      <HelpHero />
      <HelpContact />
      <HelpReport />
      <HelpEmail />
    </main>
  );
}
