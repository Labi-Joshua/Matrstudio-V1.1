"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPath } from "../../lib/content/api";
import { LEVEL_OPTIONS, TOPIC_OPTIONS } from "../../lib/content/options";
import { Modal, ModalActions } from "./modal";
import { Field, PathIcon, Select, TextArea, TextInput } from "./ui";

/** PT2 (643:6107): the basics. The path starts as a draft and opens in the editor. */
export function NewPathModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("beginner");
  const [topic, setTopic] = useState("");
  const [errors, setErrors] = useState<{ title?: string; topic?: string }>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function create() {
    const found: typeof errors = {};
    if (!title.trim()) found.title = "Give the path a title.";
    if (!topic) found.topic = "Choose a topic.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setFailure(null);
    const result = await createPath({
      title: title.trim(),
      description: description.trim(),
      level,
      topic,
    });
    if (!result.ok) {
      setBusy(false);
      setFailure(result.fieldErrors?.title ?? result.message);
      return;
    }
    router.push(`/paths/edit?id=${encodeURIComponent(result.data.id)}`);
  }

  return (
    <Modal
      title="New path"
      subtitle="Start with the basics. You’ll add modules and lessons next."
      icon={<PathIcon className="size-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <ModalActions
          onCancel={onClose}
          confirmLabel="Create draft"
          onConfirm={create}
          busy={busy}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-2xl bg-bg-fill1 p-4">
          <Field label="Title" error={errors.title}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                data-autofocus
                aria-describedby={describedBy}
                invalid={invalid}
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          <Field label="Description">
            {({ id }) => (
              <TextArea
                id={id}
                rows={3}
                maxLength={400}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Level">
              {({ id }) => (
                <Select id={id} value={level} onChange={(e) => setLevel(e.target.value)}>
                  {LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Topic" error={errors.topic}>
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  <option value="">Choose a topic</option>
                  {TOPIC_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </div>
        <p className="text-[13px] text-text-tertiary">
          You can change all of this later. New paths start as drafts.
        </p>
        {failure ? (
          <p role="alert" className="text-[13px] text-error-text">
            Nothing was created. {failure}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
