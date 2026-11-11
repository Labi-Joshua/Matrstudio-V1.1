"use client";

import { Suspense } from "react";
import { LinkReportScreen } from "../../../../components/review/link-report-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LinkReportScreen />
    </Suspense>
  );
}
