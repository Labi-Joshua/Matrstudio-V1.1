import type { Metadata } from "next";
import { ContactSupport } from "../../../../../components/app-help/contact-support";
import { pageMeta } from "../../../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Contact support | Matr Studio",
    description: "Send a message to the Matr Studio team.",
    path: "/learn/help/contact",
  }),
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ContactSupport />;
}
