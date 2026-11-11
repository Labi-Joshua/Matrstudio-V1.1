import { Suspense } from "react";
import { AuditScreen } from "../../../components/super/audit-log";
import { PageFrame } from "../../../components/super/page-frame";

export const metadata = { title: "Audit log · Matr Studio admin" };

export default function Page() {
  return (
    <PageFrame>
      <Suspense>
        <AuditScreen />
      </Suspense>
    </PageFrame>
  );
}
