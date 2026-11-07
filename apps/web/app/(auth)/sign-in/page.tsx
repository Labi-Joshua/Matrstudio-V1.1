import type { Metadata } from "next";
import { SignInForm } from "../../../components/auth/sign-in-form";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Sign in | Matr Studio",
    description: "Sign in to Matr Studio to pick up your learning paths.",
    path: ROUTES.signIn,
  }),
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return <SignInForm />;
}
