import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourceDetail } from "../../../../../components/app-library/resource-detail";
import { buildLibraryModel } from "../../../../../lib/app/library-data";
import { getCatalogue } from "../../../../../lib/catalogue/data";
import { ROUTES } from "../../../../../lib/routes";
import { pageMeta } from "../../../../../lib/site";

/** Only resources in the catalogue (or the design sample while it is empty) have a page. */
export const dynamicParams = false;

export function generateStaticParams() {
  return buildLibraryModel(getCatalogue()).items.map((item) => ({ id: item.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = buildLibraryModel(getCatalogue()).items.find((i) => i.id === id);
  return {
    ...pageMeta({
      // Resource titles are plain text (docs/SECURITY-AUTH.md section 8); Next escapes them.
      title: `${item?.title ?? "Resource"} | Matr Studio`,
      description: "A free resource in the Matr Studio library.",
      path: `${ROUTES.app.library}/${id}`,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function ResourcePage({ params }: Props) {
  const { id } = await params;
  const model = buildLibraryModel(getCatalogue());
  const item = model.items.find((i) => i.id === id);
  if (!item) notFound();
  return <ResourceDetail item={item} all={model.items} />;
}
