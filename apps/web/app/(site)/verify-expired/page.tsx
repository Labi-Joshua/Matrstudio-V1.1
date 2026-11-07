import type { Metadata } from "next";
import { NoticePage } from "../../../components/pages/company/notice-page";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

// Landing page for a link in an email sent during the waitlist; not indexed.
export const metadata: Metadata = {
  ...pageMeta({
    title: "Link expired | Matr Studio",
    description: "This confirmation link has expired.",
    path: "/verify-expired",
  }),
  robots: { index: false, follow: true },
};

export default function VerifyExpiredPage() {
  return (
    <NoticePage
      title="This link has expired"
      secondary={{ href: ROUTES.help, label: "Help centre" }}
    >
      "Confirmation links only work for 24 hours. The waitlist has now closed, so there’s nothing
      you need to do. If you think you should still be hearing from us, write to
      hello@matrstudio.com."
    </NoticePage>
  );
}
