import type { Metadata } from "next";
import { SignUpScreen } from "../../../components/auth/sign-up-screen";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Create your account | Matr Studio",
    description: "Create a Matr Studio account to start your learning paths.",
    path: ROUTES.signUp,
  }),
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return <SignUpScreen />;
}
