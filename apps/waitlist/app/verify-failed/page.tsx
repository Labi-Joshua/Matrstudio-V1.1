import { VerifyState } from "../../components/verify/verify-state";
import { WaitlistForm } from "../../components/waitlist-form";

// Landing page for confirmation-email links: keep it out of search results.
export const metadata = {
  title: "Link not recognised | Matr Studio",
  robots: { index: false, follow: false },
};

// Figma: Link Not Recognised (187:1510 light, 187:2063 dark). For links that are broken, unknown
// or replaced by a newer email. The form signs up again, which resends the link to a pending
// address (or starts a new signup).
export default function VerifyFailedPage() {
  return (
    <VerifyState
      icon={{ name: "verify-link-2-off.svg", tone: "error" }}
      badge={{ label: "Link not recognised", tone: "error" }}
      title="This link isn’t working"
      actions={
        <div className="flex w-full flex-col items-center gap-4">
          <WaitlistForm
            variant="primary"
            source="verify-failed"
            submitLabel="Send new link"
            pendingLabel="Sending…"
            className="w-full items-center"
          />
          <p className="max-w-[480px] text-center text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
            Got a newer email from us? Use the link in that one — only the latest link works.
          </p>
        </div>
      }
    >
      It may have been cut off when copied, or replaced by a newer email. Enter your email and we’ll
      send you a fresh confirmation link.
    </VerifyState>
  );
}
