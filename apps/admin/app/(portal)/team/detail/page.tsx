import { Suspense } from "react";
import { MemberDetailScreen } from "../../../../components/super/member-detail";
import { PageFrame } from "../../../../components/super/page-frame";

export const metadata = { title: "Admin · Matr Studio admin" };

export default function Page() {
  return (
    <PageFrame>
      <Suspense>
        <MemberDetailScreen />
      </Suspense>
    </PageFrame>
  );
}
