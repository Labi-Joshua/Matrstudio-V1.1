import type { Metadata } from "next";
import { NoticePage } from "../../../components/pages/company/notice-page";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

// Landing page for a link in an email sent during the waitlist; not indexed.
export const metadata: Metadata = {
  ...pageMeta({
    title: "Link not valid | Matr Studio",
    description: "This confirmation link isn’t valid.",
    path: "/verify-failed",
  }),
  robots: { index: false, follow: true },
};

export default function VerifyFailedPage() {
  return (
    <NoticePage
      title="This link isn’t valid"
      secondary={{ href: ROUTES.help, label: "Help centre" }}
    >
      "We couldn’t use this confirmation link. The waitlist has now closed, so there’s nothing you
      need to do. If you think you should still be hearing from us, write to hello@matrstudio.com."
    </NoticePage>
  );
}
