"use client";

import { useId, useRef } from "react";
import {
  AVATAR_ACCEPT,
  AVATAR_ERRORS,
  type AvatarError,
  resizeAvatar,
} from "../../lib/app/profile-avatar";
import { bioCounter, bioTooLong, USERNAME_HELP } from "../../lib/app/profile-form";
import { topicChips } from "../../lib/app/profile-view";
import { TOPIC_OPTIONS } from "../../lib/pages/onboarding-content";
import { FOCUS } from "../app/ui";
import { ProfileAvatar } from "./profile-avatar";

const LABEL = "font-medium text-[14px] text-text leading-5 tracking-[-0.14px]";
const HINT = "text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]";
const ERROR = "text-[13px] text-error-text leading-[18px] tracking-[-0.13px]";
const BOX = (invalid: boolean) =>
  `flex items-center overflow-hidden rounded-lg border bg-bg-base shadow-e1 transition-[border-color,box-shadow] focus-within:ring-2 ${
    invalid
      ? "border-error-border focus-within:ring-error-focus"
      : "border-border focus-within:border-primary-border focus-within:ring-primary-focus"
  }`;
const INPUT =
  "h-9 min-w-0 flex-1 bg-transparent px-2.5 text-[16px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary md:text-[14px]";

/** What the photo will be once the form is saved. */
export type PhotoDraft =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "new"; blob: Blob; previewUrl: string };

/**
 * "Change photo" row of Edit profile. Picking a file resizes it in the browser (256 px, under
 * 200 KB); a file that cannot be used reports through `onError`, which shows the toast.
 */
export function PhotoField({
  name,
  currentUrl,
  photo,
  onPhoto,
  onError,
}: {
  name: string;
  currentUrl: string | null;
  photo: PhotoDraft;
  onPhoto: (next: PhotoDraft) => void;
  onError: (error: AvatarError) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const shown =
    photo.kind === "new" ? photo.previewUrl : photo.kind === "remove" ? null : currentUrl;

  async function pick(file: File | undefined) {
    if (!file) return;
    const result = await resizeAvatar(file);
    if (!result.ok) return onError(result.error);
    if (photo.kind === "new") URL.revokeObjectURL(photo.previewUrl);
    onPhoto({ kind: "new", blob: result.blob, previewUrl: URL.createObjectURL(result.blob) });
  }

  return (
    <div className="flex items-center gap-4 rounded-xl bg-bg-fill1 p-4">
      <ProfileAvatar url={shown} name={name} size={56} />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-col">
          <p className={LABEL}>Change photo</p>
          <p className={HINT}>Square image. We resize it for you.</p>
        </div>
        <div className="flex gap-2">
          {shown ? (
            <button
              type="button"
              onClick={() => {
                if (photo.kind === "new") URL.revokeObjectURL(photo.previewUrl);
                onPhoto({ kind: "remove" });
              }}
              className={`inline-flex h-7 items-center rounded-md border border-error-border bg-bg-base px-2.5 font-medium text-[13px] text-error-text leading-[18px] ${FOCUS}`}
            >
              Remove
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={`inline-flex h-7 items-center rounded-md border border-border bg-bg-base px-2.5 font-medium text-[13px] text-text leading-[18px] ${FOCUS}`}
          >
            Change
          </button>
          <input
            ref={input}
            type="file"
            accept={AVATAR_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose a photo"
            onChange={(event) => {
              void pick(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
}

export const photoErrorToast = (error: AvatarError) => AVATAR_ERRORS[error];

/** Username with the fixed "matrstudio.com/@" prefix, a live availability line and the rules under it. */
export function UsernameField({
  value,
  onChange,
  error,
  note,
}: {
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  /** Neutral status under the field ("Checking…", "That username is free"). */
  note: string | null;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        Username
      </label>
      <div className={BOX(error !== null)}>
        <span
          aria-hidden="true"
          className="flex h-9 items-center border-border border-r bg-bg-fill1 px-2.5 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]"
        >
          matrstudio.com/@
        </span>
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={40}
          aria-invalid={error !== null || undefined}
          aria-describedby={messageId}
          className={INPUT}
        />
      </div>
      <p id={messageId} className={error ? ERROR : HINT}>
        {error ?? note ?? USERNAME_HELP}
      </p>
    </div>
  );
}

export function BioField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  error: string | undefined;
}) {
  const id = useId();
  const counterId = `${id}-counter`;
  const over = bioTooLong(value);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        Bio
      </label>
      <div className={BOX(over || Boolean(error))}>
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          aria-invalid={over || Boolean(error) || undefined}
          aria-describedby={counterId}
          className="min-h-24 w-full resize-none bg-transparent px-2.5 py-2 text-[16px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary md:text-[14px]"
        />
      </div>
      <p id={counterId} className={`text-right ${over ? ERROR : HINT}`}>
        {error ?? bioCounter(value)}
      </p>
    </div>
  );
}

/** Interests: the onboarding topics as toggle chips (they are the same answers). */
export function InterestsField({
  selected,
  onToggle,
}: {
  selected: readonly string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className={`${LABEL} mb-2 p-0`}>Interests</legend>
      <div className="flex flex-wrap gap-2">
        {TOPIC_OPTIONS.map((topic) => {
          const on = selected.includes(topic.id);
          return (
            <button
              key={topic.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(topic.id)}
              className={`inline-flex h-7 items-center rounded-md border px-2.5 font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${FOCUS} ${
                on
                  ? "border-primary-border bg-primary-focus text-primary-text"
                  : "border-border bg-bg-base text-text-secondary hover:text-text"
              }`}
            >
              {topic.short}
            </button>
          );
        })}
      </div>
      <p className={HINT}>
        {selected.length === 0
          ? "Pick at least one to keep your interests."
          : `Shown on your profile: ${topicChips(selected).join(", ")}.`}
      </p>
    </fieldset>
  );
}
