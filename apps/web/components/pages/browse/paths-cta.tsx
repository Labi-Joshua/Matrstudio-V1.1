import { ROUTES } from "../../../lib/routes";
import { BrowseCta } from "./browse-cta";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "./page-hero";

/** Figma "CTA" 780:11848: the account prompt card under the grid. */
export function PathsCta() {
  return (
    <BrowseCta
      id="paths-cta-heading"
      title="Track your progress on every path"
      text="Create a free account to mark lessons done, save paths for later and pick up where you stopped."
    >
      {/* TODO: point at the real sign-up / sign-in once auth exists. */}
      <a href={ROUTES.signUp} className={BUTTON_PRIMARY}>
        <span className="px-0.5">Create a free account</span>
      </a>
      <a href={ROUTES.signIn} className={BUTTON_SECONDARY}>
        <span className="px-0.5">Sign in</span>
      </a>
    </BrowseCta>
  );
}
