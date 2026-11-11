"use client";

import { Suspense } from "react";
import { ProfileReportScreen } from "../../../../components/review/profile-report-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProfileReportScreen />
    </Suspense>
  );
}
