import type { Metadata } from "next";
import { ContentPage } from "../../../components/content/content-page";
import { ResourcesList } from "../../../components/content/resources-list";

export const metadata: Metadata = { title: "Resources · Matr Studio admin" };

export default function Page() {
  return (
    <ContentPage>
      <ResourcesList />
    </ContentPage>
  );
}
