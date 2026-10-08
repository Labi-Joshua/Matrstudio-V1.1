import { HomeAndMissionActions, VerifyState } from "../../components/verify/verify-state";

// Landing page for confirmation-email links: keep it out of search results.
export const metadata = {
  title: "You’re on the list | Matr Studio",
  robots: { index: false, follow: false },
  // Own canonical (the layout default points at the homepage, which mixes signals with noindex).
  alternates: { canonical: "/verified" },
};

// Figma: Email Confirmation (171:5071 light, 174:165 dark).
export default function VerifiedPage() {
  return (
    <VerifyState
      badge={{ label: "Your email has been verified", tone: "primary" }}
      title={
        <>
          {/* The emoji never wraps on its own (emoji fonts are wider on Windows than in Figma). */}
          You’re now on the <span className="whitespace-nowrap">waitlist🎊</span>
        </>
      }
      actions={<HomeAndMissionActions />}
    >
      Welcome to the community. Your email has been confirmed and we’ll be in touch once Matr Studio
      launches.
    </VerifyState>
  );
}
