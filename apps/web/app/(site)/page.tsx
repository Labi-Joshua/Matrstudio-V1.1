// Product landing page ("Product landing page · V3" in Figma), built section by section in the
// order listed in AGENTS.md §9. Exactly one <h1> per page (the hero headline).

import { Announcement } from "../../components/landing/announcement";
import { AtWork } from "../../components/landing/at-work";
import { ClosingCta } from "../../components/landing/closing-cta";
import { Features } from "../../components/landing/features";
import { Hero } from "../../components/landing/hero";
import { Pricing } from "../../components/landing/pricing";
import { Sources } from "../../components/landing/sources";
import { TagCloud } from "../../components/landing/tag-cloud";
import { UseCases } from "../../components/landing/use-cases";
import { getAnnouncement } from "../../lib/announcement";
import { getCatalogue } from "../../lib/catalogue/data";

export default function HomePage() {
  const catalogue = getCatalogue();
  const announcement = getAnnouncement();
  return (
    <main>
      <Hero />
      {announcement && <Announcement announcement={announcement} />}
      <Sources sources={catalogue.sources} />
      <TagCloud />
      <Features />
      <UseCases />
      <AtWork catalogue={catalogue} />
      <Pricing />
      <ClosingCta />
    </main>
  );
}
