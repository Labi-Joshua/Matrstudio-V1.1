import type { Metadata } from "next";
import { SavedView } from "../../../../components/app-saved/saved-view";
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

/** Figma "Saved" flow: the list, removing with Undo, and the empty state. See SavedView. */
export default function SavedPage() {
  return <SavedView />;
}
