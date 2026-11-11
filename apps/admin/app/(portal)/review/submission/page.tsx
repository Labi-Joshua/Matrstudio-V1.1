"use client";

import { Suspense } from "react";
import { SubmissionScreen } from "../../../../components/review/submission-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SubmissionScreen />
    </Suspense>
  );
}
