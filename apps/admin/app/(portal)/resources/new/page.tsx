import type { Metadata } from "next";
import { ContentPage } from "../../../../components/content/content-page";
import { NewResourceScreen } from "../../../../components/content/resource-form";

export const metadata: Metadata = { title: "New resource · Matr Studio admin" };

export default function Page() {
  return (
    <ContentPage>
      <NewResourceScreen />
    </ContentPage>
  );
}
