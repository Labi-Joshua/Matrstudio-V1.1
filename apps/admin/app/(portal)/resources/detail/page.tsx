import type { Metadata } from "next";
import { ContentPage } from "../../../../components/content/content-page";
import { ResourceDetailScreen } from "../../../../components/content/resource-detail";

export const metadata: Metadata = { title: "Resource · Matr Studio admin" };

export default function Page() {
  return (
    <ContentPage>
      <ResourceDetailScreen />
    </ContentPage>
  );
}
