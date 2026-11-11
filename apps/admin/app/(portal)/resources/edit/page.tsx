import type { Metadata } from "next";
import { ContentPage } from "../../../../components/content/content-page";
import { EditResourceScreen } from "../../../../components/content/resource-form";

export const metadata: Metadata = { title: "Edit resource · Matr Studio admin" };

export default function Page() {
  return (
    <ContentPage>
      <EditResourceScreen />
    </ContentPage>
  );
}
