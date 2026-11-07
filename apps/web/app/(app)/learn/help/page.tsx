import type { Metadata } from "next";
import { HelpHub } from "../../../../components/app-help/help-hub";
import { pageMeta } from "../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Help centre | Matr Studio",
    description: "Contact support or report a problem.",
    path: "/learn/help",
  }),
  robots: { index: false, follow: false },
};

export default function Page() {
  return <HelpHub />;
}
