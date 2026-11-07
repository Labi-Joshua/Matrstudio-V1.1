import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryView } from "../../../../components/app-library/library-view";
import { LibrarySkeleton } from "../../../../components/app-library/skeleton";
import { ROUTES } from "../../../../lib/routes";
import { pageMeta } from "../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Library | Matr Studio",
    description: "Free videos, articles and tools picked by our curators.",
    path: ROUTES.app.library,
  }),
  robots: { index: false, follow: false },
};

/** useSearchParams (filters and ?q=) needs a Suspense boundary in a static export. */
export default function LibraryPage() {
  return (
    <Suspense fallback={<LibrarySkeleton />}>
      <LibraryView />
    </Suspense>
  );
}
