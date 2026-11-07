import type { Metadata } from "next";
import { ForgotPasswordForm } from "../../../components/auth/forgot-password-form";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Forgot your password? | Matr Studio",
    description: "Enter your email and we’ll send you a link to reset your Matr Studio password.",
    path: ROUTES.forgotPassword,
  }),
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
