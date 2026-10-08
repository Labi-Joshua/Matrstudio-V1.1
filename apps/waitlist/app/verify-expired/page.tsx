import { ResendLinkActions } from "../../components/verify/resend-link";
import { VerifyState } from "../../components/verify/verify-state";

// Landing page for confirmation-email links: keep it out of search results.
export const metadata = {
  title: "Link expired | Matr Studio",
  robots: { index: false, follow: false },
  // Own canonical (the layout default points at the homepage, which mixes signals with noindex).
  alternates: { canonical: "/verify-expired" },
};

// Figma: Link Expired (187:335 light, 187:1069 dark). The API redirects here with the expired
// token (?token=...), which "Send a new link" posts back for a fresh one.
export default function VerifyExpiredPage() {
  return (
    <VerifyState
      icon={{ name: "verify-timer-off.svg", tone: "warning" }}
      badge={{ label: "Link expired", tone: "warning" }}
      title="This link has expired"
      actions={<ResendLinkActions />}
    >
      Confirmation links only work for 24 hours. Send yourself a fresh one and you’ll be confirmed
      in a click.
    </VerifyState>
  );
}
