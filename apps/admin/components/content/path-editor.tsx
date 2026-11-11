"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getPath } from "../../lib/content/api";
import { plural, savedAgo } from "../../lib/content/format";
import { LEVEL_OPTIONS, TOPIC_OPTIONS } from "../../lib/content/options";
import {
  countLessons,
  findLesson,
  lessonNumber,
  lessonsNeedingIntro,
  moveLesson,
  stepLesson,
  stepModule,
} from "../../lib/content/reorder";
import type { Lesson, Level, PathDoc } from "../../lib/content/types";
import { useLoad, useSkeletonGate } from "./hooks";
import { AddLessonsModal, LessonIntroModal } from "./path-modals";
import { ModuleList } from "./path-modules";
import { PublishModal, RemoveLessonModal, UnpublishModal } from "./path-publish-modals";
import { PathStatusBadge } from "./paths-list";
import { useToast } from "./toast";
import {
  BackLink,
  Banner,
  Button,
  ButtonLink,
  Field,
  PageFrame,
  PageHeader,
  PlusIcon,
  Select,
  Skeleton,
  StateMessage,
  Switch,
  TextInput,
} from "./ui";
import { isTemp, usePathEditor } from "./use-path-editor";

export function PathEditorScreen() {
  const id = useSearchParams().get("id");
  const { load, reload } = useLoad(`path-${id}`, (signal) =>
    id
      ? getPath(id, signal)
      : Promise.resolve({ ok: false as const, code: "not_found", message: "" }),
  );
  const showSkeleton = useSkeletonGate(load.state === "loading");
  return (
    <PageFrame>
      <BackLink href="/paths">Paths</BackLink>
      <div className="mt-4">
        {load.state === "loading" ? (
          <div role="status" aria-label="Loading the path">
            <h1 className="sr-only">Path</h1>
            {showSkeleton ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : null}
          </div>
        ) : load.state === "error" ? (
          <>
            <h1 className="sr-only">Path</h1>
            <StateMessage
              tone="error"
              title={
                load.failure.code === "not_found"
                  ? "That path doesn’t exist"
                  : "We couldn’t load this path"
              }
              body={
                load.failure.code === "not_found"
                  ? "It may have been deleted."
                  : load.failure.message
              }
              action={
                load.failure.code === "not_found" ? (
                  <ButtonLink href="/paths">Back to paths</ButtonLink>
                ) : (
                  <Button onClick={reload}>Try again</Button>
                )
              }
            />
          </>
        ) : (
          <Editor initial={load.data} />
        )}
      </div>
    </PageFrame>
  );
}

type Overlay =
  | null
  | { kind: "add"; moduleIndex: number }
  | { kind: "intro"; lesson: Lesson }
  | { kind: "remove"; lesson: Lesson }
  | { kind: "publish" }
  | { kind: "unpublish" };

function Editor({ initial }: { initial: PathDoc }) {
  const toast = useToast();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const notifySaveError = (message: string) =>
    toast({
      tone: "error",
      title: "Changes didn’t save",
      body: message,
      action: { label: "Try again", run: () => void editor.save() },
    });
  const editor = usePathEditor(initial, notifySaveError);
  const { doc, saveState, edit, save, replace, local } = editor;
  const live = doc.status === "live";
  const missingIntros = lessonsNeedingIntro(doc.modules);

  // Leaving with unsaved changes asks the browser to confirm.
  useEffect(() => {
    if (saveState === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  /** Server-side actions need what is on screen saved first (and real ids for new modules). */
  async function ensureSaved(): Promise<boolean> {
    if (saveState === "saved" && !doc.modules.some((m) => isTemp(m.id))) return true;
    return save();
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: ensureSaved reads the latest render
  const actions = useMemo(
    () => ({
      onStepLesson: (lessonId: string, dir: -1 | 1) =>
        edit((d) => ({ ...d, modules: stepLesson(d.modules, lessonId, dir) })),
      onMoveLesson: (lessonId: string, mi: number, index: number) =>
        edit((d) => ({ ...d, modules: moveLesson(d.modules, lessonId, mi, index) })),
      onEditIntro: (lesson: Lesson) => setOverlay({ kind: "intro", lesson }),
      onRemoveLesson: (lesson: Lesson) => {
        if (live) setOverlay({ kind: "remove", lesson });
        else
          edit((d) => ({
            ...d,
            modules: d.modules.map((m) => ({
              ...m,
              lessons: m.lessons.filter((l) => l.id !== lesson.id),
            })),
          }));
      },
      onAddLessons: async (moduleId: string) => {
        const index = doc.modules.findIndex((m) => m.id === moduleId);
        if (await ensureSaved()) setOverlay({ kind: "add", moduleIndex: index });
      },
      onRename: (moduleId: string, title: string) =>
        edit((d) => ({
          ...d,
          modules: d.modules.map((m) => (m.id === moduleId ? { ...m, title } : m)),
        })),
      onStepModule: (moduleId: string, dir: -1 | 1) =>
        edit((d) => ({ ...d, modules: stepModule(d.modules, moduleId, dir) })),
      onRemoveModule: (moduleId: string) =>
        edit((d) => ({ ...d, modules: d.modules.filter((m) => m.id !== moduleId) })),
    }),
    [edit, live, doc.modules, saveState],
  );

  const set = <K extends keyof PathDoc>(key: K, value: PathDoc[K]) =>
    edit((d) => ({ ...d, [key]: value }));

  const addModule = () =>
    edit((d) => ({
      ...d,
      modules: [
        ...d.modules,
        { id: `tmp-${crypto.randomUUID()}`, title: `Module ${d.modules.length + 1}`, lessons: [] },
      ],
    }));

  async function openPublish() {
    if (await ensureSaved()) setOverlay({ kind: "publish" });
  }

  const status =
    saveState === "saving"
      ? "Saving…"
      : saveState === "dirty"
        ? live
          ? "Unsaved changes"
          : "Saving soon…"
        : saveState === "error"
          ? "Not saved"
          : `last saved ${savedAgo(doc.lastSavedAt)}`;

  return (
    <>
      <PageHeader
        title={doc.title || "Untitled path"}
        badge={<PathStatusBadge status={doc.status} />}
        subtitle={
          <span aria-live="polite">
            {plural(doc.modules.length, "module")} · {plural(countLessons(doc.modules), "lesson")}
            {live ? ` · ${plural(doc.learners, "learner")}` : ""} · {status}
          </span>
        }
        actions={
          live ? (
            <>
              <Button onClick={() => setOverlay({ kind: "unpublish" })}>Unpublish</Button>
              <ButtonLink href={`/paths/preview?id=${encodeURIComponent(doc.id)}`}>
                View as learner
              </ButtonLink>
              <Button
                kind="primary"
                onClick={() => void save()}
                busy={saveState === "saving"}
                disabled={saveState === "saved"}
              >
                Save changes
              </Button>
            </>
          ) : (
            <>
              <ButtonLink href={`/paths/preview?id=${encodeURIComponent(doc.id)}`}>
                Preview
              </ButtonLink>
              <Button kind="primary" onClick={openPublish} disabled={saveState === "saving"}>
                Publish
              </Button>
            </>
          )
        }
      />

      {missingIntros > 0 && !live ? (
        <div className="mt-5">
          <Banner>
            {missingIntros === 1 ? "1 lesson needs" : `${missingIntros} lessons need`} an intro
            before you can publish.
          </Banner>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          {doc.modules.length === 0 ? (
            <div className="rounded-2xl border border-border border-dashed p-8 text-center">
              <p className="font-medium text-[16px]">No modules yet</p>
              <p className="mt-1 text-[14px] text-text-secondary">
                Add a module, then add lessons from the library.
              </p>
            </div>
          ) : (
            <ModuleList modules={doc.modules} editable actions={actions} />
          )}
          <div>
            <Button onClick={addModule}>
              <PlusIcon />
              Add module
            </Button>
          </div>
        </div>
        <SettingsPanel doc={doc} set={set} />
      </div>

      {overlay?.kind === "add" && doc.modules[overlay.moduleIndex] ? (
        <AddLessonsModal
          path={doc}
          moduleId={(doc.modules[overlay.moduleIndex] as { id: string }).id}
          onClose={() => setOverlay(null)}
          onAdded={(next, count) => {
            replace(next);
            setOverlay(null);
            toast({ tone: "success", title: `${plural(count, "lesson")} added` });
          }}
        />
      ) : null}
      {overlay?.kind === "intro" ? (
        <LessonIntroModal
          pathId={doc.id}
          lesson={overlay.lesson}
          position={lessonNumber(doc.modules, overlay.lesson.id)}
          onClose={() => setOverlay(null)}
          onSaved={(intro) => {
            const id = overlay.lesson.id;
            local((d) => ({
              ...d,
              modules: d.modules.map((m) => ({
                ...m,
                lessons: m.lessons.map((l) => (l.id === id ? { ...l, intro } : l)),
              })),
            }));
            setOverlay(null);
            toast({ tone: "success", title: "Intro saved" });
          }}
        />
      ) : null}
      {overlay?.kind === "remove" && findLesson(doc.modules, overlay.lesson.id) ? (
        <RemoveLessonModal
          path={doc}
          lesson={overlay.lesson}
          onClose={() => setOverlay(null)}
          onRemoved={(next) => {
            replace(next);
            setOverlay(null);
            toast({
              tone: "success",
              title: "Lesson removed",
              body: "Learners have been notified.",
            });
          }}
        />
      ) : null}
      {overlay?.kind === "publish" ? (
        <PublishModal
          path={doc}
          onClose={() => setOverlay(null)}
          onPublished={(next) => {
            replace(next);
            setOverlay(null);
            toast({
              tone: "success",
              title: `${next.title} is live`,
              body: "Learners can enrol now.",
            });
          }}
          onFailed={(message) =>
            toast({
              tone: "error",
              title: "Couldn’t publish",
              body: message,
              action: { label: "Try again", run: () => void openPublish() },
            })
          }
        />
      ) : null}
      {overlay?.kind === "unpublish" ? (
        <UnpublishModal
          path={doc}
          onClose={() => setOverlay(null)}
          onDone={(next) => {
            replace(next);
            setOverlay(null);
            toast({
              tone: "success",
              title: "Path unpublished",
              body: "It’s no longer in Explore.",
            });
          }}
          onFailed={(message) =>
            toast({ tone: "error", title: "Couldn’t unpublish", body: message })
          }
        />
      ) : null}
    </>
  );
}

function SettingsPanel({
  doc,
  set,
}: {
  doc: PathDoc;
  set: <K extends keyof PathDoc>(key: K, value: PathDoc[K]) => void;
}) {
  const topics =
    doc.topic && !TOPIC_OPTIONS.includes(doc.topic) ? [doc.topic, ...TOPIC_OPTIONS] : TOPIC_OPTIONS;
  return (
    <section
      aria-labelledby="path-settings"
      className="h-fit rounded-2xl border border-border-soft bg-bg-base p-5 lg:sticky lg:top-6"
    >
      <h2 id="path-settings" className="mb-4 font-medium text-[14px] leading-5">
        Path settings
      </h2>
      <div className="flex flex-col gap-4">
        <Field label="Title">
          {({ id }) => (
            <TextInput
              id={id}
              value={doc.title}
              maxLength={120}
              onChange={(e) => set("title", e.target.value)}
            />
          )}
        </Field>
        <Field label="Level">
          {({ id }) => (
            <Select
              id={id}
              value={doc.level}
              onChange={(e) => set("level", e.target.value as Level)}
            >
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Topic">
          {({ id }) => (
            <Select id={id} value={doc.topic} onChange={(e) => set("topic", e.target.value)}>
              {doc.topic === "" ? <option value="">Choose a topic</option> : null}
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Estimated time">
          {({ id }) => (
            <TextInput
              id={id}
              value={doc.time}
              maxLength={40}
              placeholder="About 6 hours"
              onChange={(e) => set("time", e.target.value)}
            />
          )}
        </Field>
        <hr className="border-0 border-border-soft border-t" />
        <Switch
          checked={doc.showInExplore}
          onChange={(v) => set("showInExplore", v)}
          label="Show in Explore"
        />
        <Switch
          checked={doc.certificate}
          onChange={(v) => set("certificate", v)}
          label="Certificate on completion"
        />
        <Switch
          checked={doc.inviteOnly}
          onChange={(v) => set("inviteOnly", v)}
          label="Invite only"
        />
      </div>
    </section>
  );
}
