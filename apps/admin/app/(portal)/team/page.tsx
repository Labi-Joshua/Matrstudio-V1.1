import { Suspense } from "react";
import { PageFrame } from "../../../components/super/page-frame";
import { TeamScreen } from "../../../components/super/team-list";

export const metadata = { title: "Admin team · Matr Studio admin" };

export default function Page() {
  return (
    <PageFrame>
      <Suspense>
        <TeamScreen />
      </Suspense>
    </PageFrame>
  );
}
