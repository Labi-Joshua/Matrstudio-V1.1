"use client";

import { useEffect, useMemo, useState } from "react";
import {
  draftChanges,
  draftErrors,
  draftFromProfile,
  hasChanges,
  needsAvailabilityCheck,
  normaliseUsername,
  type ProfileDraft,
  takenMessage,
  usernameMessage,
  usernameProblem,
} from "../../lib/app/profile-form";
import { saveOnboarding } from "../../lib/auth/onboarding-api";
import {
  checkUsername,
  type OwnProfile,
  removeAvatar,
  updateProfile,
  uploadAvatar,
} from "../../lib/auth/profile-api";
import type { TopicSlug } from "../../lib/catalogue/types";
import { isTopicId } from "../../lib/pages/onboarding-content";
import { SpinnerIcon } from "../app/icons";
import { BTN_DARK, BTN_SECONDARY } from "../app-library/ui";
import { TextField } from "../auth/field";
import { DialogShell } from "./dialog-shell";
import {
  BioField,
  InterestsField,
  type PhotoDraft,
  PhotoField,
  photoErrorToast,
  UsernameField,
} from "./edit-fields";
import { PencilIcon } from "./profile-icons";

type Availability = "idle" | "checking" | "free" | "taken" | "reserved";

const SAVE_FAILED = {
  title: "Your profile didn’t save",
  body: "Something went wrong. Your changes are still here, so try again.",
} as const;

/**
 * Edit profile (Figma "Profile: edit", "username taken", "photo too big", "couldn't save"). The
 * username is checked against the API while typing (after a short pause), the photo is resized in
 * the browser, and nothing is sent until Save. A failed save keeps the dialog open with
 * everything the learner typed; a taken username shows under the field and blocks Save.
 */
export function EditProfileDialog({
  profile,
  topics,
  onClose,
  onProfile,
  onTopics,
  onToast,
}: {
  profile: OwnProfile;
  topics: readonly string[];
  onClose: () => void;
  /** The API returned a newer profile (after the photo or the fields saved). */
  onProfile: (profile: OwnProfile) => void;
  onTopics: (topics: string[]) => void;
  onToast: (tone: "success" | "error", title: string, body: string) => void;
}) {
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  const [photo, setPhoto] = useState<PhotoDraft>({ kind: "keep" });
  const [selected, setSelected] = useState<string[]>(() => [...topics]);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Free the preview picture when the dialog goes away.
  useEffect(
    () => () => {
      if (photo.kind === "new") URL.revokeObjectURL(photo.previewUrl);
    },
    [photo],
  );

  const errors = draftErrors(draft);
  const username = normaliseUsername(draft.username);
  const typing = draft.username.length > 0 && usernameProblem(draft.username) !== null;

  // Ask the API whether the username is free once typing pauses.
  useEffect(() => {
    if (!needsAvailabilityCheck(profile, username)) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const result = await checkUsername(username, controller.signal);
      if (controller.signal.aborted) return;
      if (!result.ok) return setAvailability("idle");
      if (result.data.available) return setAvailability("free");
      setAvailability(result.data.reason === "reserved" ? "reserved" : "taken");
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [profile, username]);

  let usernameError: string | null = serverError;
  if (!usernameError && typing) usernameError = errors.username ?? null;
  if (!usernameError && availability === "taken")
    usernameError = takenMessage(username, draft.displayName);
  if (!usernameError && availability === "reserved") usernameError = usernameMessage("reserved");

  const topicsChanged = useMemo(
    () => selected.length > 0 && [...selected].sort().join() !== [...topics].sort().join(),
    [selected, topics],
  );
  const changes = draftChanges(profile, draft);
  const dirty = hasChanges(changes) || photo.kind !== "keep" || topicsChanged;
  const blocked =
    Object.keys(errors).length > 0 ||
    serverError !== null ||
    availability === "taken" ||
    availability === "reserved" ||
    availability === "checking";

  function edit(next: Partial<ProfileDraft>) {
    setDraft((current) => ({ ...current, ...next }));
    if (next.username !== undefined) setServerError(null);
  }

  async function save() {
    if (saving || blocked || !dirty) return;
    setSaving(true);
    let latest = profile;
    const fail = () => {
      onToast("error", SAVE_FAILED.title, SAVE_FAILED.body);
      setSaving(false);
    };

    if (photo.kind !== "keep") {
      const result = photo.kind === "new" ? await uploadAvatar(photo.blob) : await removeAvatar();
      if (!result.ok) {
        if (result.status === 413) {
          const words = photoErrorToast("too-big");
          onToast("error", words.title, words.body);
          setSaving(false);
          return;
        }
        return fail();
      }
      latest = result.data;
      onProfile(result.data);
      setPhoto({ kind: "keep" });
    }

    if (hasChanges(changes)) {
      const result = await updateProfile(changes);
      if (!result.ok) {
        if (result.fieldErrors?.username || result.status === 409) {
          setServerError(
            result.status === 409
              ? takenMessage(username, draft.displayName)
              : (result.fieldErrors?.username ?? usernameMessage("reserved")),
          );
          setSaving(false);
          return;
        }
        return fail();
      }
      latest = result.data;
      onProfile(result.data);
    }

    if (topicsChanged) {
      const result = await saveOnboarding({ topics: selected.filter(isTopicId) as TopicSlug[] });
      if (!result.ok) return fail();
      onTopics(result.data.topics);
    }

    onToast("success", "Profile updated", "Your changes are saved.");
    setSaving(false);
    onProfile(latest);
    onClose();
  }

  return (
    <DialogShell
      icon={<PencilIcon size={24} />}
      title="Edit profile"
      description="This is what you see on your profile. Your email stays private."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            aria-disabled={saving || blocked || !dirty}
            aria-busy={saving || undefined}
            className={`${BTN_DARK} aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
          >
            {saving ? <SpinnerIcon size={16} /> : null}
            Save changes
          </button>
        </>
      }
    >
      <PhotoField
        name={draft.displayName}
        currentUrl={profile.avatarUrl}
        photo={photo}
        onPhoto={setPhoto}
        onError={(error) => {
          const words = photoErrorToast(error);
          onToast("error", words.title, words.body);
        }}
      />
      <TextField
        label="Name"
        value={draft.displayName}
        onChange={(event) => edit({ displayName: event.target.value })}
        error={errors.displayName ?? null}
        autoComplete="name"
        maxLength={80}
      />
      <UsernameField
        value={draft.username}
        onChange={(next) => edit({ username: next })}
        error={usernameError}
        note={
          availability === "checking"
            ? "Checking…"
            : availability === "free"
              ? "That username is free."
              : null
        }
      />
      <BioField value={draft.bio} onChange={(next) => edit({ bio: next })} error={errors.bio} />
      <InterestsField
        selected={selected}
        onToggle={(slug) =>
          setSelected((current) =>
            current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug],
          )
        }
      />
    </DialogShell>
  );
}
