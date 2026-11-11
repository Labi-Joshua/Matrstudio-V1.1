import type { Metadata } from "next";
import { ContentPage } from "../../../../components/content/content-page";
import { PathPreviewScreen } from "../../../../components/content/path-preview";

export const metadata: Metadata = { title: "Path preview · Matr Studio admin" };

export default function Page() {
  return (
    <ContentPage>
      <PathPreviewScreen />
    </ContentPage>
  );
}
