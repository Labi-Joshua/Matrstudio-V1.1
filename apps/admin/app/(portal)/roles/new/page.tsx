import { Suspense } from "react";
import { PageFrame } from "../../../../components/super/page-frame";
import { NewRoleScreen } from "../../../../components/super/role-editor";

export const metadata = { title: "New role · Matr Studio admin" };

export default function Page() {
  return (
    <PageFrame>
      <Suspense>
        <NewRoleScreen />
      </Suspense>
    </PageFrame>
  );
}
