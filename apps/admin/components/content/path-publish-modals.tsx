"use client";

import { useState } from "react";
import {
  publishCheck,
  publishPath,
  removalImpact,
  removeLesson,
  unpublishPath,
} from "../../lib/content/api";
import type { Lesson, PathDoc } from "../../lib/content/types";
import { useLoad } from "./hooks";
import { Modal, ModalActions } from "./modal";
import {
  Banner,
  Button,
  Checkbox,
  CheckLine,
  Field,
  MailIcon,
  PathIcon,
  Skeleton,
  TextInput,
  TrashIcon,
} from "./ui";

/** PT6 (645:6504): checklist from the server, soft warnings, then publish. */
export function PublishModal({
  path,
  onClose,
  onPublished,
  onFailed,
}: {
  path: PathDoc;
  onClose: () => void;
  onPublished: (doc: PathDoc) => void;
  onFailed: (message: string) => void;
}) {
  const { load, reload } = useLoad(`check-${path.id}`, () => publishCheck(path.id));
  const [feature, setFeature] = useState(true);
  const [busy, setBusy] = useState(false);

  async function publish() {
    setBusy(true);
    const result = await publishPath(path.id, feature);
    setBusy(false);
    if (!result.ok) {
      onClose();
      onFailed(result.message);
      return;
    }
    onPublished(result.data);
  }

  const blocked = load.state !== "ready" || load.data.checks.some((c) => !c.ok);
  return (
    <Modal
      title={`Publish ${path.title}?`}
      subtitle="Learners can enrol as soon as it’s live."
      icon={<PathIcon className="size-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <ModalActions
          onCancel={onClose}
          cancelLabel="Back to editor"
          confirmLabel="Publish path"
          onConfirm={publish}
          busy={busy}
          disabled={blocked}
        />
      }
    >
      {load.state === "loading" ? (
        <div role="status" aria-label="Checking the path" className="space-y-3">
          <Skeleton className="h-32 w-full" />
        </div>
      ) : load.state === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-3 text-[14px]">
          <p>We couldn’t check the path. {load.failure.message}</p>
          <Button onClick={reload}>Try again</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-bg-fill1 p-4">
            <p className="mb-2 font-medium text-[14px]">Checklist</p>
            <div className="flex flex-col gap-1.5">
              {load.data.checks.map((c) => (
                <CheckLine key={c.key} ok={c.ok}>
                  {c.label}
                </CheckLine>
              ))}
            </div>
          </div>
          {load.data.checks.some((c) => !c.ok) ? (
            <p className="text-[13px] text-text-secondary">Fix what’s marked, then publish.</p>
          ) : null}
          {load.data.warnings.map((w) => (
            <Banner key={w}>{w}</Banner>
          ))}
          <Checkbox
            checked={feature}
            onChange={setFeature}
            label="Show it at the top of Explore for a week"
          />
        </div>
      )}
    </Modal>
  );
}

/** PT9 (645:20390): leaves Explore, nobody new can enrol; enrolled learners keep progress. */
export function UnpublishModal({
  path,
  onClose,
  onDone,
  onFailed,
}: {
  path: PathDoc;
  onClose: () => void;
  onDone: (doc: PathDoc) => void;
  onFailed: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const result = await unpublishPath(path.id);
    setBusy(false);
    if (!result.ok) {
      onClose();
      onFailed(result.message);
      return;
    }
    onDone(result.data);
  }
  const stat = (label: string, n: number) => (
    <div className="flex justify-between text-[14px]">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium tabular-nums">{n.toLocaleString("en")}</span>
    </div>
  );
  return (
    <Modal
      title={`Unpublish ${path.title}?`}
      subtitle="It leaves Explore and no one new can enrol."
      icon={<PathIcon className="size-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <ModalActions
          onCancel={onClose}
          confirmLabel="Unpublish"
          onConfirm={go}
          busy={busy}
          danger
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-2xl bg-bg-fill1 p-4">
          {stat("Enrolled", path.learners)}
          {stat("In progress", path.inProgress)}
          {stat("Certificates issued", path.certificatesIssued)}
        </div>
        <p className="text-[13px] text-text-secondary">
          Enrolled learners keep the lessons they finished.
        </p>
      </div>
    </Modal>
  );
}

/** PT8 (645:16030): removing a lesson from a live path, with who gets told and the message. */
export function RemoveLessonModal({
  path,
  lesson,
  onClose,
  onRemoved,
}: {
  path: PathDoc;
  lesson: Lesson;
  onClose: () => void;
  onRemoved: (doc: PathDoc) => void;
}) {
  const { load, reload } = useLoad(`impact-${lesson.id}`, () => removalImpact(path.id, lesson.id));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const message = `“${lesson.title}” was removed from ${path.title}. Your progress is safe, and you can still find it in the library.`;

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await removeLesson(
      path.id,
      lesson.id,
      note.trim() ? `${message} ${note.trim()}` : message,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onRemoved(result.data);
  }

  const n = (v: number) => v.toLocaleString("en");
  return (
    <Modal
      title={`Remove “${lesson.title}”?`}
      subtitle="It stays in the library. Only this path changes."
      icon={<TrashIcon className="size-5" />}
      tone="danger"
      onClose={onClose}
      busy={busy}
      footer={
        <ModalActions
          onCancel={onClose}
          confirmLabel="Remove lesson"
          onConfirm={remove}
          busy={busy}
          disabled={load.state !== "ready"}
          danger
        />
      }
    >
      {load.state === "loading" ? (
        <div role="status" aria-label="Counting who is affected" className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : load.state === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-3 text-[14px]">
          <p>We couldn’t work out who this affects. {load.failure.message}</p>
          <Button onClick={reload}>Try again</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Banner>
            Progress is recalculated and anyone who finished the path keeps their badge.
          </Banner>
          <div className="flex flex-col gap-2 rounded-2xl bg-bg-fill1 p-4 text-[14px]">
            <p className="flex items-center gap-2 font-medium">
              <MailIcon /> We’ll notify {n(load.data.notify)} learners
            </p>
            <p className="flex justify-between">
              <span className="text-text-secondary">Took this lesson</span>
              <span className="tabular-nums">{n(load.data.tookLesson)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-text-secondary">On this lesson now</span>
              <span className="tabular-nums">{n(load.data.onLesson)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-text-secondary">On this path now</span>
              <span className="tabular-nums">{n(load.data.onPath)}</span>
            </p>
            <p className="text-[12px] text-text-tertiary">
              Each learner gets one notification, even if they’re in more than one group.
            </p>
          </div>
          <div className="rounded-2xl border border-border border-dashed p-3">
            <p className="text-[12px] text-text-tertiary">Message they’ll see</p>
            <p className="mt-1 text-[14px] leading-5">{message}</p>
          </div>
          <Field label="Add a note (optional)">
            {({ id }) => (
              <TextInput
                id={id}
                value={note}
                maxLength={200}
                placeholder="e.g. We replaced it with a newer video in lesson 4"
                onChange={(e) => setNote(e.target.value)}
                className="font-normal"
              />
            )}
          </Field>
          {error ? (
            <p role="alert" className="text-[13px] text-error-text">
              Nothing was removed. {error}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
