// "Page · Submit a resource" (Figma 774:7578). The frames are the signed-out marketing view: how
// submissions are reviewed, what is accepted, and sign-in prompts. The in-product submit form is
// not part of these frames, so there is deliberately no form here yet.

import { BrowseCta } from "../../../components/pages/browse/browse-cta";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  PageHero,
} from "../../../components/pages/browse/page-hero";
import { ScreenShowcase } from "../../../components/pages/browse/screen-showcase";
import { SubmitGuidelines, SubmitSteps } from "../../../components/pages/browse/submit-sections";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata = pageMeta({
  title: "Submit a free resource | Matr Studio",
  description:
    "Found a video, article or tool that made something click? Send it in. A reviewer checks every link before it goes into the library.",
  path: ROUTES.submit,
});

export default function SubmitPage() {
  return (
    <main>
      <PageHero
        id="submit-heading"
        eyebrow="Submit a resource"
        title="Share a free resource that taught you"
        intro="Found a video, article or tool that made something click? Send it in. A reviewer checks every link before it goes into the library."
      >
        {/* TODO: point at the submit flow (behind sign-in) once auth exists. */}
        <a href={ROUTES.signIn} className={BUTTON_PRIMARY}>
          <span className="px-0.5">Submit a resource</span>
        </a>
        <a href="#what-we-accept" className={BUTTON_SECONDARY}>
          <span className="px-0.5">See what we accept</span>
        </a>
      </PageHero>
      <SubmitSteps />
      <SubmitGuidelines />
      <ScreenShowcase
        folder="submit"
        label="Your submissions in the library"
        alt="The Matr Studio library after a submission: a toast confirms it was sent and the new resources sit in a list."
        altMobile="The library on a phone after a submission, with a confirmation toast."
      />
      <BrowseCta
        id="submit-cta-heading"
        title="Know a great free resource?"
        text="Sign in and send it our way. It could end up in the next path."
      >
        <a href={ROUTES.signIn} className={BUTTON_PRIMARY}>
          <span className="px-0.5">Submit a resource</span>
        </a>
        <a href={ROUTES.signUp} className={BUTTON_SECONDARY}>
          <span className="px-0.5">Create a free account</span>
        </a>
      </BrowseCta>
    </main>
  );
}
