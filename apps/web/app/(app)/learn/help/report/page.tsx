import type { Metadata } from "next";
import { ReportProblem } from "../../../../../components/app-help/report-problem";
import { pageMeta } from "../../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Report a problem | Matr Studio",
    description: "Tell us when something is broken or wrong.",
    path: "/learn/help/report",
  }),
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ReportProblem />;
}
