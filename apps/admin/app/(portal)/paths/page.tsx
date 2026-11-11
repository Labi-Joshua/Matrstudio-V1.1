import type { Metadata } from "next";
import { ContentPage } from "../../../components/content/content-page";
import { PathsList } from "../../../components/content/paths-list";

export const metadata: Metadata = { title: "Paths · Matr Studio admin" };

export default function Page() {
  return (
    <ContentPage>
      <PathsList />
    </ContentPage>
  );
}
