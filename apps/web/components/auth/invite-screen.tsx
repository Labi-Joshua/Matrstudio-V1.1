"use client";

import { useState } from "react";
import { ROUTES } from "../../lib/routes";
import { ButtonLink } from "./button";
import { CreateAccountForm } from "./create-account-form";
import { ClockAlertIcon } from "./icons";
import { ResetPasswordFallback, useResetToken } from "./reset-password-form";
import { AuthHeader, AuthScreen, IconTile } from "./shell";

/**
 * /invite?token=...: create an account from a waitlist invite (Figma 2). The token is read once,
 * held in memory and removed from the address bar (same hook as the reset link, see
 * useResetToken). A missing, used or expired invite shows the "invite isn't valid" screen.
 */
export function InviteScreen() {
  const token = useResetToken();
  const [invalid, setInvalid] = useState(false);

  if (token === undefined) return <ResetPasswordFallback />;
  if (token === null || invalid) {
    return (
      <AuthScreen>
        <AuthHeader
          focusTitle
          icon={
            <IconTile tone="warning">
              <ClockAlertIcon size={24} />
            </IconTile>
          }
          title="This invite isn’t valid"
          description="The link may have expired (invites last 72 hours) or already been used. You can still create an account with your email."
        />
        <ButtonLink href={ROUTES.signUp}>Create an account</ButtonLink>
        <ButtonLink href={ROUTES.signIn} variant="secondary">
          Sign in
        </ButtonLink>
      </AuthScreen>
    );
  }
  return <CreateAccountForm inviteToken={token} onInviteInvalid={() => setInvalid(true)} />;
}
