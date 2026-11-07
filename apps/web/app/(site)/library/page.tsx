// "Page · Library" (Figma 774:929). One <h1> (inside LibraryExplorer's hero).

import Link from "next/link";
import { BrowseCta } from "../../../components/pages/browse/browse-cta";
import { LibraryExplorer } from "../../../components/pages/browse/library-explorer";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "../../../components/pages/browse/page-hero";
import { getCatalogue } from "../../../lib/catalogue/data";
import { getLibraryData } from "../../../lib/pages/browse-library";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata = pageMeta({
  title: "Free design and dev resource library | Matr Studio",
  description:
    "Search free videos, articles, docs and tools for designers and developers, tagged by topic, format and source.",
  path: ROUTES.library,
});

export default function LibraryPage() {
  const { resources, totalLabel } = getLibraryData(getCatalogue());
  return (
    <main>
      <LibraryExplorer resources={resources} totalLabel={totalLabel} />
      <BrowseCta
        id="library-cta-heading"
        title="Save what you find"
        text="Create a free account to bookmark resources and build your own reading list."
      >
        {/* TODO: point at the real sign-up once auth exists. */}
        <a href="#get-started" className={BUTTON_PRIMARY}>
          <span className="px-0.5">Create a free account</span>
        </a>
        <Link href={ROUTES.submit} className={BUTTON_SECONDARY}>
          <span className="px-0.5">Submit a resource</span>
        </Link>
      </BrowseCta>
    </main>
  );
}
