"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { learnedTime } from "../../lib/app/profile-view";
import { usernameFromLocation } from "../../lib/app/profile-visibility";
import { getPublicProfile, type PublicProfile } from "../../lib/auth/profile-api";
import { ROUTES } from "../../lib/routes";
import { useSkeletonGate } from "../app/hooks";
import { BTN_PRIMARY, BTN_SECONDARY, StateBlock } from "../app-library/ui";
import { LockIcon } from "./profile-icons";
import { CARD, EmptyNote, ProfileCard, PublicSubmissions, SectionHeading } from "./profile-parts";
import { PublicSkeleton } from "./public-skeleton";

type State =
  | { status: "loading" }
  | { status: "ready"; profile: PublicProfile }
  /** Private, unknown and malformed names all look the same on purpose. */
  | { status: "private" }
  | { status: "error"; limited: boolean };

const STAT_LABELS = [
  ["pathsFinished", "Paths finished"],
  ["lessonsDone", "Lessons done"],
  ["minutesLearned", "Time learned"],
  ["streakDays", "Current streak"],
] as const;

function statValue(key: (typeof STAT_LABELS)[number][0], value: number): string {
  if (key === "minutesLearned") return learnedTime(value);
  if (key === "streakDays") return `${value} ${value === 1 ? "day" : "days"}`;
  return String(value);
}

/**
 * The public profile page (Figma "Public profile: visitor view", "Private profile (visitor)",
 * "Profile: loading"). A static page: the username comes from the address (/@name, which the
 * Worker serves from /u, or /u?name=name) and the profile is fetched in the browser without a
 * session. Only what the owner switched on is ever in the answer; a private or unknown profile
 * shows the same "private" screen.
 */
export function PublicProfileView() {
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    setUsername(usernameFromLocation(window.location.pathname, window.location.search));
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloads` re-runs the load on purpose
  useEffect(() => {
    if (username === undefined) return;
    if (username === null) return setState({ status: "private" });
    const controller = new AbortController();
    setState({ status: "loading" });
    getPublicProfile(username, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) return setState({ status: "ready", profile: result.data });
      if (result.code === "not_found") return setState({ status: "private" });
      setState({ status: "error", limited: result.code === "rate_limited" });
    });
    return () => controller.abort();
  }, [username, reloads]);

  const retry = useCallback(() => setReloads((n) => n + 1), []);
  const loading = state.status === "loading";
  const gate = useSkeletonGate(loading);

  // A private profile must not be indexed; the shell is noindex already, this is for the record.
  useEffect(() => {
    document.title =
      state.status === "ready"
        ? `${state.profile.displayName} | Matr Studio`
        : "Profile | Matr Studio";
  }, [state]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[1000px] flex-col gap-6 px-5 pt-6 pb-16 lg:px-8">
      {loading || gate ? (
        <>
          <h1 className="sr-only">Profile</h1>
          <PublicSkeleton visible={gate} />
        </>
      ) : state.status === "private" ? (
        <PrivateProfile />
      ) : state.status === "error" ? (
        <div className="flex flex-col items-center">
          <h1 className="sr-only">Profile</h1>
          <StateBlock
            role="alert"
            glyph="alert"
            title="Couldn’t load this profile"
            body={
              state.limited
                ? "Too many people are looking right now. Try again in a few minutes."
                : "Check your connection and try again."
            }
          >
            <button type="button" onClick={retry} className={BTN_PRIMARY}>
              Try again
            </button>
          </StateBlock>
        </div>
      ) : (
        <ProfileBody profile={state.profile} />
      )}
    </main>
  );
}

function PrivateProfile() {
  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center gap-3 px-2 py-16 text-center md:py-24">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full border border-primary-border/60 border-dashed bg-primary-accent text-primary-text"
      >
        <LockIcon size={24} />
      </span>
      <div className="flex flex-col gap-1 pt-2">
        <h1 className="font-medium text-[18px] text-text leading-7 tracking-[-0.18px]">
          This profile is private
        </h1>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          The person who owns it hasn’t made it public, or the link has changed.
        </p>
      </div>
      <Link href={ROUTES.home} className={`${BTN_PRIMARY} mt-2`}>
        Explore Matr Studio
      </Link>
    </div>
  );
}

function ProfileBody({ profile }: { profile: PublicProfile }) {
  const first = profile.displayName.trim().split(/\s+/)[0] || profile.displayName;
  const { stats, completedPaths, submissions } = profile;
  return (
    <>
      <ProfileCard
        displayName={profile.displayName}
        username={profile.username}
        level={profile.level}
        joinedAt={profile.joinedAt}
        bio={profile.bio}
        topics={profile.topics}
        avatarUrl={profile.avatarUrl}
        visitor
      />

      {stats ? (
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {STAT_LABELS.map(([key, label]) => (
            <div key={key} className="rounded-xl bg-bg-fill1 px-4 py-3">
              <dd className="font-medium text-[20px] text-text leading-7 tracking-[-0.2px]">
                {statValue(key, stats[key])}
              </dd>
              <dt className="text-[12px] text-text-secondary leading-4 tracking-[-0.12px]">
                {label}
              </dt>
            </div>
          ))}
        </dl>
      ) : null}

      {completedPaths && completedPaths.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading title="Completed paths" />
          <ul className="grid gap-3 md:grid-cols-2">
            {completedPaths.map((path) => (
              <li key={path.slug} className={`${CARD} p-3 text-[14px] text-text`}>
                {path.slug}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {submissions ? (
        <section className="flex flex-col gap-3">
          <SectionHeading title="Shared resources" />
          {submissions.length > 0 ? (
            <PublicSubmissions rows={submissions} />
          ) : (
            <EmptyNote>{first} hasn’t shared an approved resource yet.</EmptyNote>
          )}
        </section>
      ) : null}

      <aside className="flex flex-col gap-1 rounded-xl bg-primary-accent p-4">
        <p className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
          Learn alongside {first}
        </p>
        <p className="text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
          Free, curated learning paths for designers and developers.
        </p>
        <Link href={ROUTES.signUp} className={`${BTN_SECONDARY} mt-2 w-fit`}>
          Join Matr Studio
        </Link>
      </aside>
    </>
  );
}
