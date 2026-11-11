"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, type Ref, useId, useMemo, useRef, useState } from "react";
import {
  EMPTY_DRAFT,
  feedbackForFailure,
  firstErrorField,
  NOTE_MAX,
  type SubmitDraft,
  type SubmitErrors,
  type SubmitFeedback,
  type SubmitField,
  validateDraft,
} from "../../lib/app/submit-state";
import {
  checkLink,
  findInLibrary,
  hostLabel,
  LINK_MESSAGES,
  stripHttpsPrefix,
} from "../../lib/app/submit-url";
import { authErrorCopy } from "../../lib/auth/messages";
import {
  createSubmission,
  type Submission,
  updateSubmission,
} from "../../lib/auth/submissions-api";
import { getCatalogue } from "../../lib/catalogue/data";
import { ROUTES } from "../../lib/routes";
import {
  boxClasses,
  describedBy,
  FieldShell,
  SelectField,
  TextAreaField,
} from "../app-help/fields";
import { Banner, bannerActionClasses, StatusRegion } from "../auth/banner";
import { Button } from "../auth/button";
import { CircleAlertIcon } from "../auth/icons";
import { TURNSTILE_CONFIGURED, Turnstile, type TurnstileHandle } from "../auth/turnstile";

/**
 * The Submit a resource form (Figma Library > Submit flow: 1 Form opens, 2 Form filled, 3 Broken
 * link, 4 Already in the library, "Submit: sending (loading)" and "couldn’t send (error)"; the
 * edit variant is frame 8 "Edit and resubmit"). The Figma frames show it as a dialog over the
 * Library; here it is the page body of /learn/submit, a card on desktop and the full page on
 * phones.
 *
 * Deviation: the design has a "Type" select (Video / Article / Tool), but the submissions API has
 * no type field, so it is left out until the API carries it (a curator sets the format anyway).
 */
export type Mode = { kind: "new" } | { kind: "edit"; submission: Submission };

export function SubmitForm({
  mode,
  bare = false,
  onDone,
  onCancel,
  onShowMine,
}: {
  mode: Mode;
  /** No card chrome: the dialog around it supplies the surface and padding. */
  bare?: boolean;
  /** The API accepted the submission (created or resubmitted). */
  onDone: (submission: Submission, mode: Mode["kind"]) => void;
  onCancel: () => void;
  onShowMine: () => void;
}) {
  const editing = mode.kind === "edit";
  const catalogue = useMemo(() => getCatalogue(), []);
  const [draft, setDraft] = useState<SubmitDraft>(() =>
    mode.kind === "edit"
      ? {
          url: mode.submission.url,
          title: mode.submission.title ?? "",
          topic: mode.submission.topic ?? "",
          note: mode.submission.note ?? "",
        }
      : EMPTY_DRAFT,
  );
  const [errors, setErrors] = useState<SubmitErrors>({});
  const [feedback, setFeedback] = useState<SubmitFeedback | null>(null);
  const [pending, setPending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const topicRef = useRef<HTMLSelectElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // "Already in the library" is checked as the link is typed (client-side, against the catalogue).
  const inLibrary = useMemo(
    () => (editing ? null : findInLibrary(draft.url, catalogue.resources, catalogue.sources)),
    [editing, draft.url, catalogue],
  );

  function change<K extends keyof SubmitDraft>(key: K, value: SubmitDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFeedback(null);
  }

  // The broken-link state (Figma 3) shows as soon as the learner leaves the field.
  function checkLinkOnBlur() {
    if (draft.url.trim() === "") return;
    const link = checkLink(draft.url);
    if (!link.ok) setErrors((e) => ({ ...e, url: LINK_MESSAGES[link.problem] }));
  }

  function focusField(field: SubmitField | null) {
    const target = { url: urlRef, title: titleRef, topic: topicRef, note: noteRef }[field ?? "url"];
    target.current?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const next = validateDraft(draft, !editing);
    setErrors(next);
    setFeedback(null);
    const first = firstErrorField(next);
    if (first) return focusField(first);
    if (inLibrary) return focusField("url");

    if (!editing && TURNSTILE_CONFIGURED && !captchaToken) {
      setFeedback({
        fieldErrors: {},
        alreadySubmitted: false,
        resetCaptcha: false,
        banner: {
          tone: "warning",
          ...authErrorCopy({ ok: false, code: "captcha_required", message: "" }),
        },
      });
      return;
    }

    setPending(true);
    const fields = {
      title: draft.title.trim(),
      topic: draft.topic,
      ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
    };
    const link = checkLink(draft.url);
    const result =
      mode.kind === "edit"
        ? await updateSubmission(mode.submission.id, fields)
        : link.ok
          ? await createSubmission({ url: link.url, ...fields, captchaToken })
          : null;
    if (!editing) captcha.current?.reset(); // a Turnstile token is single use
    setPending(false);
    if (!result) return;

    if (result.ok) {
      onDone(result.data, mode.kind);
      return;
    }
    const mapped = feedbackForFailure(result);
    setErrors(mapped.fieldErrors);
    setFeedback(mapped);
    const field = firstErrorField(mapped.fieldErrors);
    if (field) focusField(field);
  }

  const urlError = errors.url ?? null;
  const showBanner = feedback?.banner ?? null;

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="submit-form-title"
      aria-busy={pending || undefined}
      className={`flex w-full flex-col gap-5 ${
        bare
          ? ""
          : "max-w-[560px] md:mx-auto md:rounded-3xl md:border md:border-border-soft md:bg-bg-base md:p-8 md:shadow-card"
      }`}
    >
      <h2 id="submit-form-title" className="sr-only">
        {editing ? "Edit and resubmit" : "Submit a resource"}
      </h2>

      {mode.kind === "edit" ? (
        <EditIntro submission={mode.submission} />
      ) : (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-bg-fill1 p-5">
          <LinkField
            ref={urlRef}
            value={draft.url}
            error={urlError}
            invalid={Boolean(inLibrary)}
            onChange={(value) => change("url", stripHttpsPrefix(value))}
            onBlur={checkLinkOnBlur}
          />
        </div>
      )}

      {inLibrary ? (
        <AlertBox title="Already in the library">
          “{inLibrary.title}”{inLibrary.sourceName ? ` by ${inLibrary.sourceName}` : ""} is already
          here. Thanks for looking out.
          <Link
            href={ROUTES.app.library}
            className="mt-2 block w-fit rounded-sm font-medium text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border"
          >
            View it
          </Link>
        </AlertBox>
      ) : null}

      {feedback?.alreadySubmitted ? (
        <AlertBox title="You’ve already sent this link">
          It’s in your submissions, so there’s nothing more to do.
          <button
            type="button"
            onClick={onShowMine}
            className="mt-2 block w-fit rounded-sm font-medium text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border"
          >
            See my submissions
          </button>
        </AlertBox>
      ) : null}

      <fieldset
        disabled={pending}
        className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0 transition-opacity disabled:opacity-60"
      >
        <legend className="sr-only">Resource details</legend>
        <TitleField
          ref={titleRef}
          value={draft.title}
          error={errors.title ?? null}
          onChange={(value) => change("title", value)}
        />
        <SelectField
          ref={topicRef}
          label="Topic"
          required
          name="topic"
          placeholder="Choose a topic"
          value={draft.topic}
          error={errors.topic}
          onChange={(e) => change("topic", e.target.value)}
        >
          {catalogue.topics.map((topic) => (
            <option key={topic.slug} value={topic.slug}>
              {topic.name}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          ref={noteRef}
          label="Why it helps"
          name="note"
          rows={4}
          max={NOTE_MAX}
          placeholder="A clear, beginner-friendly walkthrough of variables, modes and tokens."
          hint="Optional. Curators read this first."
          value={draft.note}
          error={errors.note}
          onChange={(e) => change("note", e.target.value)}
        />
      </fieldset>

      {!editing && TURNSTILE_CONFIGURED ? (
        <div className="max-w-full overflow-x-auto">
          <Turnstile ref={captcha} onToken={setCaptchaToken} />
        </div>
      ) : null}

      <StatusRegion politeness="assertive">
        {showBanner ? (
          <Banner
            tone={showBanner.tone}
            title={showBanner.title}
            action={
              showBanner.retry ? (
                <button type="submit" className={bannerActionClasses}>
                  Try again
                </button>
              ) : undefined
            }
          >
            {showBanner.description}
          </Banner>
        ) : null}
      </StatusRegion>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <div className="w-full sm:w-fit">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        <div className="w-full sm:w-fit">
          <Button
            type="submit"
            pending={pending}
            pendingLabel={editing ? "Resubmitting" : "Sending"}
          >
            {editing ? "Resubmit for review" : "Submit for review"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function AlertBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-[10px] border border-border bg-bg-elevation-1 p-3 shadow-e1"
    >
      <span className="shrink-0 text-warning-text">
        <CircleAlertIcon />
      </span>
      <div className="min-w-0 flex-1 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        <p className="font-medium text-text">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** Edit mode: the link cannot change, and the curator's note is the reason they are here. */
function EditIntro({ submission }: { submission: Submission }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 rounded-2xl bg-bg-fill1 p-5">
        <p className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">Link</p>
        <p className="break-all text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          {hostLabel(submission.url)}
        </p>
        <p className="text-[12px] text-text-secondary leading-4 tracking-[-0.12px]">
          The link can’t be changed. To send a different one, submit it as a new resource.
        </p>
      </div>
      {submission.curatorNote ? (
        <AlertBox title="A curator asked for a change">{submission.curatorNote}</AlertBox>
      ) : null}
    </div>
  );
}

function TitleField({
  ref,
  value,
  error,
  onChange,
}: {
  ref: Ref<HTMLInputElement>;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label="Title" required error={error}>
      <div className={`flex items-center overflow-hidden ${boxClasses(Boolean(error))}`}>
        <input
          ref={ref}
          id={id}
          name="title"
          type="text"
          autoComplete="off"
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error)}
          placeholder="Design systems with Figma variables"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-[16px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary lg:text-[14px]"
        />
      </div>
    </FieldShell>
  );
}

function LinkField({
  ref,
  value,
  error,
  invalid,
  onChange,
  onBlur,
}: {
  ref: Ref<HTMLInputElement>;
  value: string;
  error: string | null;
  onBlur: () => void;
  /** Red border without its own message (the "already in the library" alert explains it). */
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const hint = "Paste a link to a free video, article or tool.";
  return (
    <FieldShell id={id} label="Link" required error={error} hint={hint}>
      <div className={`flex items-center overflow-hidden ${boxClasses(Boolean(error) || invalid)}`}>
        <span className="flex h-9 shrink-0 items-center border-border border-r bg-bg-base px-2.5 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          https://
        </span>
        <input
          ref={ref}
          id={id}
          name="url"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="youtube.com/watch?v=…"
          value={value}
          aria-invalid={error || invalid ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-[16px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary lg:text-[14px]"
        />
      </div>
    </FieldShell>
  );
}
