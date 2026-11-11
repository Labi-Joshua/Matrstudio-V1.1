"use client";

import { useState } from "react";
import { saveFailureToast } from "../../lib/app/settings-state";
import {
  type AccountSummary,
  accountFailureKind,
  cancelEmailChange,
  getAccount,
  resendEmailChange,
  startGoogleLink,
  unlinkGoogle,
} from "../../lib/auth/account-api";
import { ROUTES } from "../../lib/routes";
import { useSession } from "../app/session";
import { CircleAlertIcon, GoogleIcon } from "../auth/icons";
import { DeleteDialog } from "./delete-dialog";
import { EmailDialog } from "./email-dialog";
import { PasswordDialog } from "./password-dialog";
import { LoadedView } from "./skeleton";
import { useSettingsToast } from "./toast";
import { BTN_SMALL, LINK_BUTTON, Section, SettingCard, Switch } from "./ui";
import { useLoaded } from "./use-loaded";

type Dialog = "email" | "password" | "delete" | null;

/** /settings/account (Figma 10 to 12): email, password, sign-in methods and delete account. */
export function AccountSection() {
  const { state, reload } = useLoaded(getAccount);
  return (
    <LoadedView state={state} what="your account" onRetry={reload}>
      {(account) => <AccountBody account={account} reload={reload} />}
    </LoadedView>
  );
}

const FIELD =
  "flex h-10 min-w-0 flex-1 items-center rounded-lg border border-border-soft bg-bg-fill1 px-3 text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]";

function AccountBody({ account, reload }: { account: AccountSummary; reload: () => void }) {
  const { me } = useSession();
  const toast = useSettingsToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState<"resend" | "cancel" | "google" | null>(null);
  const close = () => setDialog(null);

  async function resend() {
    setBusy("resend");
    const result = await resendEmailChange();
    setBusy(null);
    toast(
      result.ok
        ? { tone: "success", title: "Link sent", body: "Check the inbox of your new address." }
        : saveFailureToast(result),
    );
  }

  async function cancel() {
    setBusy("cancel");
    const result = await cancelEmailChange();
    setBusy(null);
    if (result.ok) {
      toast({ tone: "info", title: "Email change cancelled", body: "Your email stays the same." });
      reload();
    } else toast(saveFailureToast(result));
  }

  async function toggleGoogle(next: boolean) {
    setBusy("google");
    if (next) {
      const result = await startGoogleLink(ROUTES.settingsAccount);
      if (!result.ok) {
        setBusy(null);
        toast({
          tone: "error",
          title: "Couldn’t connect Google",
          body: "Google sign-in isn’t available right now. Try again later.",
        });
      }
      return;
    }
    const result = await unlinkGoogle();
    setBusy(null);
    if (result.ok) {
      toast({ tone: "success", title: "Google disconnected" });
      reload();
      return;
    }
    if (accountFailureKind(result) === "last_sign_in_method") {
      toast({
        tone: "error",
        title: "Keep one way to sign in",
        body: "Google is your only way in. Set a password first, then disconnect it.",
      });
    } else if (result.code === "reauth_required") {
      toast({
        tone: "error",
        title: "Sign in again first",
        body: "Disconnecting Google needs a recent sign-in.",
      });
    } else toast(saveFailureToast(result));
  }

  return (
    <>
      <Section title="Email" description="We use this to sign you in and send updates.">
        {account.pendingEmail ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl bg-info-focus p-3 text-primary-text"
          >
            <span className="mt-0.5 shrink-0 text-utility-blue">
              <CircleAlertIcon />
            </span>
            <div className="flex flex-col gap-1 text-[14px] leading-5 tracking-[-0.14px]">
              <p className="font-medium text-text">Confirm your new email</p>
              <p className="text-text-secondary">
                We sent a link to {account.pendingEmail.email}. Your email changes once you open it.
              </p>
              <p className="flex flex-wrap items-center gap-x-2 text-utility-blue">
                <button
                  type="button"
                  onClick={resend}
                  aria-disabled={busy !== null || undefined}
                  className={LINK_BUTTON}
                >
                  Resend link
                </button>
                <span aria-hidden="true">•</span>
                <button
                  type="button"
                  onClick={cancel}
                  aria-disabled={busy !== null || undefined}
                  className={LINK_BUTTON}
                >
                  Cancel change
                </button>
              </p>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
            Email
          </span>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <p className={FIELD}>
              <span className="truncate">{me.email}</span>
            </p>
            <button
              type="button"
              onClick={() => setDialog("email")}
              className={`${BTN_SMALL} self-start md:self-auto`}
            >
              Change email
            </button>
          </div>
        </div>
      </Section>

      <Section
        title="Password"
        description={
          account.hasPassword
            ? "Use at least 12 characters. We’ll ask for your current password first."
            : "You sign in with Google. Add a password to also sign in with your email."
        }
      >
        <div className="flex flex-col gap-1.5">
          <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
            Password
          </span>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <p className={FIELD}>
              {account.hasPassword ? (
                <span aria-hidden="true" className="tracking-[3px]">
                  ••••••••••
                </span>
              ) : (
                "No password set"
              )}
              <span className="sr-only">
                {account.hasPassword ? "A password is set" : "No password set"}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setDialog("password")}
              className={`${BTN_SMALL} self-start md:self-auto`}
            >
              {account.hasPassword ? "Change password" : "Set a password"}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Sign-in methods" description="Keep at least one way to sign in.">
        <SettingCard
          id="google"
          icon={<GoogleIcon />}
          title="Google"
          description={account.google.linked ? "Connected" : "Not connected"}
          on={account.google.linked}
          control={
            <Switch
              checked={account.google.linked}
              onChange={toggleGoogle}
              labelledBy="google-t"
              describedBy="google-d"
              disabled={busy === "google"}
            />
          }
        />
      </Section>

      <Section title="Delete account">
        <div className="flex items-start gap-2 rounded-xl border border-border-soft p-3.5">
          <span className="mt-0.5 shrink-0 text-error-text">
            <CircleAlertIcon />
          </span>
          <div className="flex flex-col gap-1 text-[14px] leading-5 tracking-[-0.14px]">
            <p className="font-medium text-text">Delete your account</p>
            <p className="text-text-secondary">
              This permanently removes your profile, progress, saved items and submissions. It can’t
              be undone.
            </p>
            <p>
              <button
                type="button"
                onClick={() => setDialog("delete")}
                className={`${LINK_BUTTON} text-error-text`}
              >
                Delete account
              </button>
            </p>
          </div>
        </div>
      </Section>

      {dialog === "email" ? (
        <EmailDialog
          hasPassword={account.hasPassword}
          onClose={close}
          onSent={(email) => {
            close();
            toast({
              tone: "success",
              title: "Check your new inbox",
              body: `We sent a link to ${email}.`,
            });
            reload();
          }}
        />
      ) : null}
      {dialog === "password" ? (
        <PasswordDialog
          hasPassword={account.hasPassword}
          onClose={close}
          onDone={() => {
            close();
            toast({
              tone: "success",
              title: account.hasPassword ? "Password updated" : "Password set",
              body: "We signed you out of your other devices.",
            });
            reload();
          }}
        />
      ) : null}
      {dialog === "delete" ? <DeleteDialog account={account} onClose={close} /> : null}
    </>
  );
}
