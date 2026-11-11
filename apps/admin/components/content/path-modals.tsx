"use client";

import { useEffect, useState } from "react";
import { addLessons, listResources, saveLessonIntro } from "../../lib/content/api";
import { durationLabel, metaLine } from "../../lib/content/format";
import { TYPE_OPTIONS } from "../../lib/content/options";
import type { Lesson, PathDoc, ResourceRow } from "../../lib/content/types";
import { useDebounced } from "./hooks";
import { Modal, ModalActions } from "./modal";
import {
  Button,
  Checkbox,
  ChipTabs,
  Field,
  LibraryIcon,
  SearchIcon,
  Select,
  Skeleton,
  TextArea,
  TextInput,
  TYPE_LABEL,
} from "./ui";

/** PT4 (643:15630): pick resources from the library; each becomes a lesson. */
export function AddLessonsModal({
  path,
  moduleId,
  onClose,
  onAdded,
}: {
  path: PathDoc;
  moduleId: string;
  onClose: () => void;
  onAdded: (doc: PathDoc, count: number) => void;
}) {
  const [target, setTarget] = useState(moduleId);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [rows, setRows] = useState<ResourceRow[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounced(q.trim(), 300);

  const inPath = new Set(path.modules.flatMap((m) => m.lessons.map((l) => l.resourceId)));

  // biome-ignore lint/correctness/useExhaustiveDependencies: nonce retries
  useEffect(() => {
    const ctrl = new AbortController();
    setRows(null);
    setFailed(null);
    listResources(
      { tab: "all", status: "live", q: debounced || undefined, type, limit: 40 },
      ctrl.signal,
    ).then((r) => {
      if (ctrl.signal.aborted) return;
      if (r.ok) setRows(r.data.items);
      else setFailed(r.message);
    });
    return () => ctrl.abort();
  }, [debounced, type, nonce]);

  const available = (rows ?? []).filter((r) => !inPath.has(r.id));
  const already = (rows ?? []).filter((r) => inPath.has(r.id));
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function add() {
    setBusy(true);
    setError(null);
    const result = await addLessons(path.id, picked, target);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onAdded(result.data, picked.length);
  }

  return (
    <Modal
      title="Add lessons"
      subtitle="Pick resources from the library. Each one becomes a lesson."
      icon={<LibraryIcon className="size-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <ModalActions
          onCancel={onClose}
          confirmLabel={
            picked.length === 0
              ? "Add lessons"
              : `Add ${picked.length} ${picked.length === 1 ? "lesson" : "lessons"}`
          }
          onConfirm={add}
          busy={busy}
          disabled={picked.length === 0}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Add to">
          {({ id }) => (
            <Select id={id} value={target} onChange={(e) => setTarget(e.target.value)}>
              {path.modules.map((m, i) => (
                <option key={m.id} value={m.id}>
                  Module {i + 1} · {m.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Search">
          {({ id }) => (
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-3 left-3 size-4 text-text-tertiary" />
              <TextInput
                id={id}
                data-autofocus
                type="search"
                placeholder="Search the library"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
        </Field>
        <ChipTabs
          label="Resource type"
          value={type}
          onChange={setType}
          items={[
            { value: "all", label: "All" },
            ...TYPE_OPTIONS.slice(0, 3).map((o) => ({ value: o.value as string, label: o.label })),
          ]}
        />
        <div aria-live="polite">
          {failed ? (
            <div role="alert" className="flex flex-col items-start gap-2 text-[14px]">
              <p>We couldn’t load the library. {failed}</p>
              <Button onClick={() => setNonce((n) => n + 1)}>Try again</Button>
            </div>
          ) : rows === null ? (
            <div role="status" aria-label="Loading resources" className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : available.length === 0 && already.length === 0 ? (
            <p className="py-6 text-center text-[14px] text-text-secondary">
              No live resources match. Try another word.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {already.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border-soft px-3 py-2.5 opacity-60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] leading-5">{r.title}</p>
                    <p className="text-[12px] text-text-tertiary leading-4">Already in this path</p>
                  </div>
                  <span className="text-[12px] text-text-secondary">{TYPE_LABEL[r.type]}</span>
                </li>
              ))}
              {available.map((r) => (
                <li
                  key={r.id}
                  className={`rounded-xl border border-border-soft px-3 py-2.5 ${picked.includes(r.id) ? "bg-bg-fill1" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Checkbox
                      checked={picked.includes(r.id)}
                      onChange={() => toggle(r.id)}
                      label={<span className="font-medium">{r.title}</span>}
                      hint={metaLine([r.source, durationLabel(r.durationMin, r.type)])}
                    />
                    <span className="shrink-0 text-[12px] text-text-secondary">
                      {TYPE_LABEL[r.type]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error ? (
          <p role="alert" className="text-[13px] text-error-text">
            Nothing was added. {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/** PT5 (643:21294): the intro learners read before opening the resource. */
export function LessonIntroModal({
  pathId,
  lesson,
  position,
  onClose,
  onSaved,
}: {
  pathId: string;
  lesson: Lesson;
  position: number;
  onClose: () => void;
  onSaved: (intro: string) => void;
}) {
  const [text, setText] = useState(lesson.intro);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await saveLessonIntro(pathId, lesson.id, text.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved(text.trim());
  }

  return (
    <Modal
      title={`Lesson ${position} · ${lesson.title}`}
      subtitle="Write what learners see before they open the resource."
      icon={<LibraryIcon className="size-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <ModalActions onCancel={onClose} confirmLabel="Save intro" onConfirm={save} busy={busy} />
      }
    >
      <Field
        label="Intro"
        hint={`${text.length} of 400 characters`}
        error={error ? `Not saved. ${error}` : null}
      >
        {({ id, describedBy, invalid }) => (
          <TextArea
            id={id}
            data-autofocus
            aria-describedby={describedBy}
            invalid={invalid}
            rows={5}
            maxLength={400}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </Field>
    </Modal>
  );
}
