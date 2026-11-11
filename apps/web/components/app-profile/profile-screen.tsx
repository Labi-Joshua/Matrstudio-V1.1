"use client";

import { useMemo, useState } from "react";
import { publicRowText } from "../../lib/app/profile-visibility";
import { updateProfile } from "../../lib/auth/profile-api";
import { getCatalogue } from "../../lib/catalogue/data";
import type { TopicSlug } from "../../lib/catalogue/types";
import { ROUTES } from "../../lib/routes";
import { useSkeletonGate } from "../app/hooks";
import { useSession } from "../app/session";
import { BTN_PRIMARY, BTN_SECONDARY, StateBlock } from "../app-library/ui";
import { useSubmissions } from "../app-submit/use-submissions";
import { EditProfileDialog } from "./edit-dialog";
import {
  EmptyNote,
  LiveBanner,
  OwnSubmissions,
  ProfileCard,
  PublicRow,
  SectionHeading,
  VisibilityBadge,
} from "./profile-parts";
import { ProfileSkeleton } from "./profile-skeleton";
import { ProfileToastHost, useProfileToast } from "./profile-toast";
import { PublicProfileDialog } from "./public-dialog";
import { useOwnProfile } from "./use-own-profile";

type Dialog = "edit" | "public" | null;

/**
 * /profile (Figma "Profile (your view)", "Profile updated", "Public profile is live", "Profile:
 * loading"): who you are on Matr Studio, the Public profile switch, your finished paths and your
 * submissions. Edit profile and Make your profile public are dialogs opened from here.
 *
 * Honest data: learning stats and finished paths have no API yet (path progress ships
 * separately), so those parts say so instead of showing numbers. Submissions are the real ones.
 */
export function ProfileScreen() {
  const { me } = useSession();
  const { state, reload, set } = useOwnProfile();
  const submissions = useSubmissions(true);
  const { toast, show, dismiss } = useProfileToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [topics, setTopics] = useState<string[] | null>(null);
  const [switching, setSwitching] = useState(false);

  const loading = state.status === "loading";
  const gate = useSkeletonGate(loading);
  const topicNames = useMemo(
    () => new Map(getCatalogue().topics.map((topic) => [topic.slug, topic.name])),
    [],
  );

  async function turnOff() {
    if (state.status !== "ready" || switching) return;
    setSwitching(true);
    const result = await updateProfile({ isPublic: false });
    setSwitching(false);
    if (result.ok) {
      set(result.data);
      show("success", "Your profile is private", "Only you can see it now.");
    } else {
      show("error", "Couldn’t change that", "Something went wrong. Your profile is still public.");
    }
  }

  const toasts = <ProfileToastHost toast={toast} onDismiss={dismiss} />;

  if (loading || gate) {
    return (
      <div className="mx-auto w-full max-w-[1240px]">
        <h1 className="sr-only">Profile</h1>
        <ProfileSkeleton visible={gate} />
        {toasts}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto w-full max-w-[1240px]">
        <h1 className="sr-only">Profile</h1>
        <StateBlock
          role="alert"
          glyph="alert"
          title="Couldn’t load your profile"
          body="Check your connection and try again. Nothing you saved has been lost."
        >
          <button type="button" onClick={reload} className={BTN_PRIMARY}>
            Try again
          </button>
        </StateBlock>
        {toasts}
      </div>
    );
  }

  const { profile } = state;
  const shownTopics = topics ?? me.onboarding.topics;
  const level = me.onboarding.level;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <ProfileCard
        displayName={profile.displayName || me.name || "Your profile"}
        username={profile.username}
        level={level}
        joinedAt={profile.createdAt}
        bio={profile.bio}
        topics={shownTopics}
        avatarUrl={profile.avatarUrl}
        badge={<VisibilityBadge isPublic={profile.isPublic} />}
        action={
          <button type="button" onClick={() => setDialog("edit")} className={BTN_SECONDARY}>
            Edit profile
          </button>
        }
      />

      <PublicRow
        isPublic={profile.isPublic}
        text={publicRowText(profile)}
        pending={switching}
        onChange={(next) => (next ? setDialog("public") : void turnOff())}
      />
      {profile.isPublic ? <LiveBanner username={profile.username} /> : null}

      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Completed paths"
          href={ROUTES.app.paths}
          linkLabel="See all in My paths"
        />
        <EmptyNote>
          Path progress isn’t tracked yet. Your learning stats and finished paths will show up here
          once it is.
        </EmptyNote>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Submissions"
          href={ROUTES.app.submit}
          linkLabel="See all in My submissions"
        />
        {submissions.list.status === "ready" ? (
          submissions.list.rows.length > 0 ? (
            <OwnSubmissions
              rows={submissions.list.rows.slice(0, 4)}
              topicName={(slug) => (slug ? (topicNames.get(slug as TopicSlug) ?? null) : null)}
            />
          ) : (
            <EmptyNote>
              You haven’t submitted a resource yet. Approved ones show here, and on your public
              profile if you choose.
            </EmptyNote>
          )
        ) : submissions.list.status === "error" ? (
          <EmptyNote>
            We couldn’t load your submissions.{" "}
            <button
              type="button"
              onClick={submissions.reload}
              className="font-medium text-primary-text hover:underline"
            >
              Try again
            </button>
          </EmptyNote>
        ) : (
          <p role="status" className="text-[14px] text-text-secondary">
            Loading your submissions…
          </p>
        )}
      </section>

      {dialog === "edit" ? (
        <EditProfileDialog
          profile={profile}
          topics={shownTopics}
          onClose={() => setDialog(null)}
          onProfile={set}
          onTopics={setTopics}
          onToast={show}
        />
      ) : null}
      {dialog === "public" ? (
        <PublicProfileDialog
          profile={profile}
          onClose={() => setDialog(null)}
          onEditUsername={() => setDialog("edit")}
          onProfile={set}
          onToast={show}
        />
      ) : null}
      {toasts}
    </div>
  );
}
