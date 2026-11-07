import type { Metadata } from "next";
import { SubmitScreen } from "../../../../components/app-submit/submit-screen";
import { pageMeta } from "../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Submit a resource | Matr Studio",
    description: "Share a free video, article or tool for curators to review.",
    path: "/learn/submit",
  }),
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SubmitScreen />;
}
