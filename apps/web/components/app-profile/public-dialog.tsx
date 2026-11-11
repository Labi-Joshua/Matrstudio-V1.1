"use client";

import { useState } from "react";
import {
  ALWAYS_PRIVATE,
  publicLinkText,
  toggleVisibility,
  VISIBILITY_OPTIONS,
  type VisibilityKey,
} from "../../lib/app/profile-visibility";
import { type OwnProfile, type ProfileVisibility, updateProfile } from "../../lib/auth/profile-api";
import { SpinnerIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { BTN_DARK, BTN_SECONDARY } from "../app-library/ui";
import { DialogShell } from "./dialog-shell";
import { InfoCircleIcon, LockIcon, TickIcon, TrophyIcon, UserIcon } from "./profile-icons";

const OPTION_ICON: Record<VisibilityKey, typeof TrophyIcon> = {
  stats: TrophyIcon,
  paths: TickIcon,
  submissions: UserIcon,
};

/**
 * Make your profile public (Figma "Public profile: choose what shows"): the link, one checkbox
 * per section (learning stats, completed paths, approved submissions) and the things that are
 * never shown. "Make public" saves the choice and turns the profile on in one request.
 */
export function PublicProfileDialog({
  profile,
  onClose,
  onEditUsername,
  onProfile,
  onToast,
}: {
  profile: OwnProfile;
  onClose: () => void;
  /** "Change your username in Edit profile": closes this dialog and opens the edit one. */
  onEditUsername: () => void;
  onProfile: (profile: OwnProfile) => void;
  onToast: (tone: "success" | "error", title: string, body: string) => void;
}) {
  const [visibility, setVisibility] = useState<ProfileVisibility>(profile.visibility);
  const [saving, setSaving] = useState(false);

  async function publish() {
    if (saving) return;
    setSaving(true);
    const result = await updateProfile({ isPublic: true, visibility });
    if (!result.ok) {
      onToast(
        "error",
        "Your profile didn’t go public",
        "Something went wrong. Nothing has changed, so try again.",
      );
      setSaving(false);
      return;
    }
    onProfile(result.data);
    onToast(
      "success",
      "Your profile is public",
      `Anyone can now see it at ${publicLinkText(result.data.username)}.`,
    );
    onClose();
  }

  return (
    <DialogShell
      icon={<UserIcon size={24} />}
      title="Make your profile public"
      description="Anyone with the link can see it. Choose what to show."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            Cancel
          </button>
          <button
            type="button"
            onClick={publish}
            aria-disabled={saving}
            aria-busy={saving || undefined}
            className={`${BTN_DARK} aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
          >
            {saving ? <SpinnerIcon size={16} /> : null}
            Make public
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5 rounded-xl bg-bg-fill1 p-4">
        <p className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">Your link</p>
        <p className="rounded-lg border border-border bg-bg-base px-2.5 py-2 text-[14px] text-text leading-5 tracking-[-0.14px]">
          {publicLinkText(profile.username)}
        </p>
        <p className="text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
          <button
            type="button"
            onClick={onEditUsername}
            className={`rounded-sm text-primary-text hover:underline ${FOCUS}`}
          >
            Change your username in Edit profile
          </button>
        </p>
      </div>

      <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <legend className="sr-only">What to show on your public profile</legend>
        {VISIBILITY_OPTIONS.map((option) => {
          const Icon = OPTION_ICON[option.key];
          const on = visibility[option.key];
          return (
            <label
              key={option.key}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-border ${
                on ? "border-primary-border bg-primary-accent" : "border-border bg-bg-base"
              }`}
            >
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bg-fill1 text-text-secondary"
              >
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
                  {option.title}
                </span>
                <span className="block text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
                  {option.description}
                </span>
              </span>
              <input
                type="checkbox"
                checked={on}
                onChange={() => setVisibility((current) => toggleVisibility(current, option.key))}
                className="size-4 shrink-0 accent-primary"
              />
            </label>
          );
        })}
      </fieldset>

      <div className="flex items-start gap-2 rounded-xl bg-bg-fill1 p-3">
        <span className="mt-0.5 text-text-secondary">
          <InfoCircleIcon size={16} />
        </span>
        <div>
          <p className="flex items-center gap-1.5 font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
            <LockIcon size={14} className="text-text-secondary" />
            Always private
          </p>
          <p className="text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
            {ALWAYS_PRIVATE}
          </p>
        </div>
      </div>
    </DialogShell>
  );
}
