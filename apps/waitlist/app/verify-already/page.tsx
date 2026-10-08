import { HomeAndMissionActions, VerifyState } from "../../components/verify/verify-state";

// Landing page for confirmation-email links: keep it out of search results.
export const metadata = {
  title: "Already confirmed | Matr Studio",
  robots: { index: false, follow: false },
  // Own canonical (the layout default points at the homepage, which mixes signals with noindex).
  alternates: { canonical: "/verify-already" },
};

// Figma: Link Already Confirmed (187:2498 light, 187:3057 dark).
export default function VerifyAlreadyPage() {
  return (
    <VerifyState
      icon={{ name: "verify-circle-check.svg", tone: "success" }}
      badge={{ label: "Already confirmed", tone: "success" }}
      title="You’re already on the list"
      actions={<HomeAndMissionActions />}
    >
      This email was confirmed earlier, so there’s nothing more to do. We’ll be in touch as soon as
      Matr Studio launches.
    </VerifyState>
  );
}
