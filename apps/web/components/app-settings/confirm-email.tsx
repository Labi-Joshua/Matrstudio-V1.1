"use client";

import { useSearchParams } from "next/navigation";
import { confirmEmailView } from "../../lib/app/settings-email-link";
import { useMe } from "../../lib/auth/use-me";
import { ROUTES } from "../../lib/routes";
import { ButtonLink } from "../auth/button";
import { CircleCheckIcon, ClockAlertIcon, LinkOffIcon, SpinnerIcon } from "../auth/icons";
import { AuthHeader, AuthScreen, IconTile } from "../auth/shell";

export function ConfirmEmailFallback() {
  return (
    <AuthScreen>
      <AuthHeader title="Checking your link" />
      <p
        role="status"
        className="flex items-center gap-2 text-[14px] text-text-secondary leading-5"
      >
        <SpinnerIcon /> One moment.
      </p>
    </AuthScreen>
  );
}

/**
 * /settings/confirm-email: where the link in the "confirm your new email" message lands (Figma
 * "Settings: confirm new email"). Reachable signed in or out, like the other email-link pages.
 * Opening a good link changes the address and signs every device out, so the success screen sends
 * the learner to sign in with the new address.
 */
export function ConfirmEmail() {
  const view = confirmEmailView(useSearchParams().get("error"));
  const { state } = useMe();
  if (state.status === "loading") return <ConfirmEmailFallback />;
  const signedIn = state.status === "authenticated";

  if (view === "changed") {
    return (
      <AuthScreen>
        <AuthHeader
          focusTitle
          icon={
            <IconTile tone="success">
              <CircleCheckIcon size={24} />
            </IconTile>
          }
          title="Your email is updated"
          description="Your new address is confirmed. For your security we signed you out everywhere. Sign in with your new email to continue."
        />
        <div className="flex flex-col gap-3">
          <ButtonLink href={ROUTES.signIn}>Sign in</ButtonLink>
          <ButtonLink href={ROUTES.home} variant="secondary">
            Back to homepage
          </ButtonLink>
        </div>
      </AuthScreen>
    );
  }

  const copy =
    view === "expired"
      ? {
          tone: "warning" as const,
          icon: <ClockAlertIcon size={24} />,
          title: "This link has expired",
          description:
            "Email change links only work for 24 hours. Start the change again from Settings and we’ll send a fresh link.",
        }
      : view === "used"
        ? {
            tone: "success" as const,
            icon: <CircleCheckIcon size={24} />,
            title: "This link was already used",
            description:
              "Your email was changed with this link earlier, so there’s nothing more to do. Sign in with your new address.",
          }
        : {
            tone: "primary" as const,
            icon: <LinkOffIcon size={24} />,
            title: "This link isn’t working",
            description:
              "It may have been cut off when copied, replaced by a newer email, or the change was cancelled. Start the change again from Settings.",
          };
  return (
    <AuthScreen>
      <AuthHeader
        focusTitle
        icon={<IconTile tone={copy.tone}>{copy.icon}</IconTile>}
        title={copy.title}
        description={copy.description}
      />
      <div className="flex flex-col gap-3">
        {signedIn && view !== "used" ? (
          <ButtonLink href={ROUTES.settingsAccount}>Back to settings</ButtonLink>
        ) : (
          <ButtonLink href={ROUTES.signIn}>Sign in</ButtonLink>
        )}
        <ButtonLink href={ROUTES.home} variant="secondary">
          Back to homepage
        </ButtonLink>
      </div>
    </AuthScreen>
  );
}
