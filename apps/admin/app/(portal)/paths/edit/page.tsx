import type { Metadata } from "next";
import { ContentPage } from "../../../../components/content/content-page";
import { PathEditorScreen } from "../../../../components/content/path-editor";

export const metadata: Metadata = { title: "Edit path · Matr Studio admin" };

export default function Page() {
  return (
    <ContentPage>
      <PathEditorScreen />
    </ContentPage>
  );
}
