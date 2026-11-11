import type { Metadata } from "next";
import { RequestScreen } from "../../../../../components/app-help/request-detail";
import { pageMeta } from "../../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Your request | Matr Studio",
    description: "Follow a support request or report.",
    path: "/learn/help/request",
  }),
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RequestScreen />;
}
