"use client";

import Link from "next/link";
import { useState } from "react";
import { savedToast, saveFailureToast } from "../../lib/app/settings-state";
import { downloadMyData } from "../../lib/auth/account-api";
import { getProfileIsPublic, setProfileIsPublic } from "../../lib/auth/prefs-api";
import { ROUTES } from "../../lib/routes";
import { ThemeSwitch } from "../app/ui";
import { useSkeletonGate } from "../app-library/browse-loading";
import { BAR } from "../app-library/skeleton";
import { useSettingsToast } from "./toast";
import { BTN_SMALL, Section, SettingCard, Switch } from "./ui";
import { useLoaded } from "./use-loaded";

/** /settings/appearance (Figma 15): theme, public profile switch, data download and legal links. */
export function AppearanceSection() {
  return (
    <>
      <Section title="Theme" description="Also in the sidebar, under Support.">
        <div className="max-w-[260px]">
          <ThemeSwitch name="Settings" />
        </div>
      </Section>
      <Section
        title="Public profile"
        description="Share your stats, completed paths and approved submissions."
      >
        <PublicProfile />
      </Section>
      <Section
        title="Your data"
        description="Get a copy of your profile, progress, saved items and submissions."
      >
        <DownloadData />
      </Section>
      <Section title="Legal">
        <p className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          <Link href={ROUTES.privacy} className="hover:text-text hover:underline">
            Privacy policy
          </Link>
          <Link href={ROUTES.terms} className="hover:text-text hover:underline">
            Terms of use
          </Link>
        </p>
      </Section>
    </>
  );
}

function PublicProfile() {
  const { state, reload, set } = useLoaded(getProfileIsPublic);
  const toast = useSettingsToast();

  async function change(next: boolean) {
    const before = !next;
    set(() => next);
    const result = await setProfileIsPublic(next);
    if (result.ok) {
      set(() => result.data);
      toast(savedToast());
      return;
    }
    set(() => before);
    toast(saveFailureToast(result));
  }

  const loading = state.status === "loading";
  const gate = useSkeletonGate(loading);
  if (loading || gate) {
    return (
      <div role="status" aria-busy="true">
        <p className="sr-only">Loading your privacy setting</p>
        {gate ? <div aria-hidden="true" className={`${BAR} h-[70px] w-full rounded-xl`} /> : null}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-border-soft p-3.5 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]"
      >
        <span className="min-w-0 flex-1">Couldn’t load your privacy setting.</span>
        <button type="button" onClick={reload} className={BTN_SMALL}>
          Try again
        </button>
      </div>
    );
  }
  const isPublic = state.data;
  return (
    <SettingCard
      id="public"
      icon={<ProfileGlyph />}
      title="Public profile"
      description={
        isPublic
          ? "On. Anyone with your link can see your profile."
          : "Off. Only you can see your profile."
      }
      on={isPublic}
      control={
        <Switch checked={isPublic} onChange={change} labelledBy="public-t" describedBy="public-d" />
      }
    />
  );
}

function ProfileGlyph() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function DownloadData() {
  const toast = useSettingsToast();
  const [pending, setPending] = useState(false);

  async function download() {
    if (pending) return;
    setPending(true);
    const result = await downloadMyData();
    setPending(false);
    if (!result.ok) {
      toast({
        tone: "error",
        title: "Couldn’t download your data",
        body:
          result.code === "rate_limited"
            ? "You can download your data a few times an hour. Try again later."
            : "Check your connection and try again.",
      });
      return;
    }
    const url = URL.createObjectURL(result.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "matr-studio-data.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast({ tone: "success", title: "Your data is downloading" });
  }

  return (
    <div>
      <button
        type="button"
        onClick={download}
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
        className={BTN_SMALL}
      >
        {pending ? "Preparing" : "Download my data"}
      </button>
    </div>
  );
}
