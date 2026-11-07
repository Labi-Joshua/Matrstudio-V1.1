import type { Metadata } from "next";
import { Suspense } from "react";
import { PathsCatalogue } from "../../../../components/app-paths/paths-catalogue";
import { CatalogueSkeleton } from "../../../../components/app-paths/skeletons";
import { ROUTES } from "../../../../lib/routes";
import { pageMeta } from "../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Learning paths | Matr Studio",
    description: "Browse structured learning paths on Matr Studio.",
    path: ROUTES.app.paths,
  }),
  robots: { index: false, follow: false },
};

/** useSearchParams (the ?q= search) must sit inside Suspense on a static export; the fallback is the loading state. */
export default function PathsPage() {
  return (
    <Suspense fallback={<CatalogueSkeleton />}>
      <PathsCatalogue />
    </Suspense>
  );
}
