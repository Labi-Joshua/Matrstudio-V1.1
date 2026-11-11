import { Suspense } from "react";
import { PageFrame } from "../../../components/super/page-frame";
import { RolesScreen } from "../../../components/super/roles-list";

export const metadata = { title: "Roles and permissions · Matr Studio admin" };

export default function Page() {
  return (
    <PageFrame>
      <Suspense>
        <RolesScreen />
      </Suspense>
    </PageFrame>
  );
}
