// "Page · Saved" (Figma 774:7040): the signed-out marketing view of the Saved feature. The real
// saved list lives in the product; this page explains it and points at sign-in.

import { BrowseCta } from "../../../components/pages/browse/browse-cta";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  PageHero,
} from "../../../components/pages/browse/page-hero";
import { SavedSteps } from "../../../components/pages/browse/saved-steps";
import { ScreenShowcase } from "../../../components/pages/browse/screen-showcase";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata = pageMeta({
  title: "Save paths and lessons for later | Matr Studio",
  description:
    "Star a path or bookmark a single lesson, then pick up exactly where you stopped, on any device. Free with a Matr Studio account.",
  path: ROUTES.saved,
});

export default function SavedPage() {
  return (
    <main>
      <PageHero
        id="saved-heading"
        eyebrow="Saved"
        title="Save paths and lessons for later"
        intro="Star a path or bookmark a single lesson, then pick up exactly where you stopped, on any device."
      >
        {/* TODO: point both at the real sign-in / sign-up once auth exists. */}
        <a href={ROUTES.signIn} className={BUTTON_PRIMARY}>
          <span className="px-0.5">Sign in to see your saved items</span>
        </a>
        <a href={ROUTES.signUp} className={BUTTON_SECONDARY}>
          <span className="px-0.5">Create a free account</span>
        </a>
      </PageHero>
      <ScreenShowcase
        folder="saved"
        label="Your saved list"
        alt="The Saved screen in Matr Studio: a grid of bookmarked resources with a type filter."
        altMobile="The Saved screen on a phone: bookmarked resources in a single column."
      />
      <SavedSteps />
      <BrowseCta
        id="saved-cta-heading"
        title="Your saved list is one sign-in away"
        text="It’s free, and it keeps your paths and lessons in one place."
      >
        <a href={ROUTES.signIn} className={BUTTON_PRIMARY}>
          <span className="px-0.5">Sign in</span>
        </a>
        <a href={ROUTES.signUp} className={BUTTON_SECONDARY}>
          <span className="px-0.5">Create a free account</span>
        </a>
      </BrowseCta>
    </main>
  );
}
