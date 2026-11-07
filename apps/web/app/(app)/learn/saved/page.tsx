import type { Metadata } from "next";
import Link from "next/link";
import { BTN_PRIMARY, PageHeader, StateBlock } from "../../../../components/app-library/ui";
import { ROUTES } from "../../../../lib/routes";
import { pageMeta } from "../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Saved | Matr Studio",
    description: "Resources you save for later.",
    path: ROUTES.app.saved,
  }),
  robots: { index: false, follow: false },
};

/**
 * Figma Saved, "Nothing saved yet". There is no saved-items API yet and the library has no
 * bookmark button, so every learner sees the empty state. The copy says so plainly instead of
 * promising a bookmark that does not exist; the list layout ("Your saved resources") is not built.
 */
export default function SavedPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <PageHeader title="Saved" intro="Resources you save will show up here." />
      <StateBlock
        glyph="saved"
        title="Nothing saved yet"
        body="Saving resources isn’t available yet. For now, browse the library and open what looks useful."
      >
        <Link href={ROUTES.app.library} className={BTN_PRIMARY}>
          Browse the library
        </Link>
      </StateBlock>
    </div>
  );
}
