import type { Metadata } from "next";
import { NoticePage } from "../../../components/pages/company/notice-page";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

// Landing page for a link in an email sent during the waitlist; not indexed.
export const metadata: Metadata = {
  ...pageMeta({
    title: "Already confirmed | Matr Studio",
    description: "This email address was already confirmed.",
    path: "/verify-already",
  }),
  robots: { index: false, follow: true },
};

export default function VerifyAlreadyPage() {
  return (
    <NoticePage
      title="You’ve already confirmed"
      secondary={{ href: ROUTES.help, label: "Help centre" }}
    >
      "This email address is already confirmed, so there’s nothing more to do. The paths and the
      resource library are open for anyone to browse."
    </NoticePage>
  );
}
