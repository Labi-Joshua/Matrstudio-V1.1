import type { Metadata } from "next";
import { NoticePage } from "../../../components/pages/company/notice-page";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

// Landing page for a link in an email sent during the waitlist; not indexed.
export const metadata: Metadata = {
  ...pageMeta({
    title: "You’re confirmed | Matr Studio",
    description: "Your email address is confirmed. We’ll write to you about Matr Studio.",
    path: "/verified",
  }),
  robots: { index: false, follow: true },
};

export default function VerifiedPage() {
  return (
    <NoticePage
      title="Your email is confirmed"
      secondary={{ href: ROUTES.help, label: "Help centre" }}
    >
      "Thanks for confirming. We’ll email you about Matr Studio. In the meantime, the paths and the
      resource library are open for anyone to browse."
    </NoticePage>
  );
}
