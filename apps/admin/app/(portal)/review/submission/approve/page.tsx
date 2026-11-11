"use client";

import { Suspense } from "react";
import { ApproveScreen } from "../../../../../components/review/approve-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ApproveScreen />
    </Suspense>
  );
}
