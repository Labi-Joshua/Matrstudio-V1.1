"use client";

import { Suspense } from "react";
import { QueueScreen } from "../../../components/review/queue-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <QueueScreen />
    </Suspense>
  );
}
