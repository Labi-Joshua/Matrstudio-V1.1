import { Suspense } from "react";
import { PageFrame } from "../../../../components/super/page-frame";
import { RoleDetailScreen } from "../../../../components/super/role-editor";

export const metadata = { title: "Role · Matr Studio admin" };

export default function Page() {
  return (
    <PageFrame>
      <Suspense>
        <RoleDetailScreen />
      </Suspense>
    </PageFrame>
  );
}
