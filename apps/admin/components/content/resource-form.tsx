"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createResource,
  getPath,
  getResource,
  listPaths,
  previewLink,
  updateResource,
} from "../../lib/content/api";
import { parseMinutes, plural } from "../../lib/content/format";
import type { PathDoc, PathRow, ResourceDetail, ResourceInput } from "../../lib/content/types";
import { useLoad, useSkeletonGate } from "./hooks";
import {
  type Draft,
  type DraftErrors,
  LearnerFields,
  LearnerPreview,
  RecordFields,
} from "./resource-fields";
import { useToast } from "./toast";
import {
  BackLink,
  Banner,
  Button,
  ButtonLink,
  Field,
  PageFrame,
  PageHeader,
  Panel,
  Radio,
  Select,
  Skeleton,
  StateMessage,
} from "./ui";

const EMPTY: Draft = {
  url: "",
  title: "",
  creator: "",
  source: "",
  type: "video",
  topic: "",
  level: "beginner",
  license: "",
  minutes: "",
  intro: "",
  learningGoal: "",
  tags: [],
  thumbnail: null,
};

export function validate(draft: Draft, publishing: boolean): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.title.trim()) errors.title = "Give it a title.";
  if (publishing) {
    if (!draft.topic) errors.topic = "Choose a topic.";
    if (!draft.license) errors.license = "Choose a licence.";
    if (!draft.intro.trim()) errors.intro = "Write the intro learners will see.";
  }
  return errors;
}

function toInput(
  draft: Draft,
  status: "draft" | "live",
  rights: "free_public" | "unsure",
): ResourceInput {
  return {
    url: draft.url,
    title: draft.title.trim(),
    creator: draft.creator.trim(),
    type: draft.type,
    topic: draft.topic,
    level: draft.level,
    license: draft.license,
    rights,
    durationMin: parseMinutes(draft.minutes),
    intro: draft.intro.trim(),
    learningGoal: draft.learningGoal.trim(),
    tags: draft.tags,
    status,
  };
}

/** /resources/new?url=… (RS5, 639:6391): what we filled in from the link, then the intro. */
export function NewResourceScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const url = params.get("url") ?? "";
  const rights = params.get("rights") === "unsure" ? "unsure" : "free_public";

  useEffect(() => {
    if (!url) router.replace("/resources?add=1");
  }, [url, router]);

  const { load, reload } = useLoad(`preview-${url}`, (signal) =>
    url
      ? previewLink(url, signal)
      : Promise.resolve({ ok: false as const, code: "none", message: "" }),
  );
  const showSkeleton = useSkeletonGate(load.state === "loading");

  if (!url) return null;
  return (
    <PageFrame>
      <BackLink href="/resources">Resources</BackLink>
      {load.state === "loading" ? (
        <div className="mt-4" role="status" aria-label="Checking the link">
          <h1 className="sr-only">New resource</h1>
          {showSkeleton ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : null}
        </div>
      ) : load.state === "error" ? (
        <>
          <h1 className="sr-only">New resource</h1>
          <StateMessage
            tone="error"
            title="We couldn’t check that link"
            body={load.failure.message || "Try again in a moment."}
            action={
              <div className="flex gap-2">
                <Button onClick={reload}>Try again</Button>
                <ButtonLink href="/resources?add=1">Use another link</ButtonLink>
              </div>
            }
          />
        </>
      ) : load.data.duplicateOf ? (
        <>
          <h1 className="sr-only">New resource</h1>
          <StateMessage
            title="Already in the library"
            body={`It’s there as “${load.data.duplicateOf.title}”.`}
            action={
              <ButtonLink
                href={`/resources/detail?id=${encodeURIComponent(load.data.duplicateOf.id)}`}
              >
                Open it
              </ButtonLink>
            }
          />
        </>
      ) : (
        <NewForm
          initial={{
            ...EMPTY,
            url,
            title: load.data.title,
            creator: load.data.creator,
            source: load.data.source,
            type: load.data.suggested.type,
            topic: load.data.suggested.topic,
            level: load.data.suggested.level,
            license: load.data.suggested.license,
            minutes: load.data.durationMin ? String(load.data.durationMin) : "",
            thumbnail: load.data.thumbnail,
          }}
          rights={rights}
        />
      )}
    </PageFrame>
  );
}

function NewForm({ initial, rights }: { initial: Draft; rights: "free_public" | "unsure" }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [busy, setBusy] = useState<"draft" | "live" | null>(null);
  const [inPath, setInPath] = useState(false);
  const [pathId, setPathId] = useState("");
  const [moduleId, setModuleId] = useState("");

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function submit(status: "draft" | "live") {
    const found = validate(draft, status === "live");
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast({ tone: "error", title: "Check the highlighted fields" });
      return;
    }
    setBusy(status);
    const input = toInput(draft, status, rights);
    if (inPath && pathId && moduleId) input.paths = [{ pathId, moduleId }];
    const result = await createResource(input);
    setBusy(null);
    if (!result.ok) {
      toast({
        tone: "error",
        title: status === "live" ? "Couldn’t publish" : "Couldn’t save the draft",
        body: result.message,
        action: { label: "Try again", run: () => submit(status) },
      });
      return;
    }
    router.push(
      `/resources/detail?id=${encodeURIComponent(result.data.id)}&notice=${status === "live" ? "published" : "saved"}`,
    );
  }

  return (
    <>
      <PageHeader
        title="New resource"
        subtitle="Check what we filled in, then write the intro learners will see."
        actions={
          <>
            <Button
              onClick={() => submit("draft")}
              busy={busy === "draft"}
              disabled={busy !== null}
            >
              Save draft
            </Button>
            <Button
              kind="primary"
              onClick={() => submit("live")}
              busy={busy === "live"}
              disabled={busy !== null}
            >
              Publish
            </Button>
          </>
        }
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <RecordFields draft={draft} errors={errors} onChange={change} />
          <LearnerFields draft={draft} errors={errors} onChange={change} />
          <WhereItGoes
            inPath={inPath}
            onInPath={setInPath}
            pathId={pathId}
            moduleId={moduleId}
            onPick={(p, m) => {
              setPathId(p);
              setModuleId(m);
            }}
          />
        </div>
        <LearnerPreview draft={draft} />
      </div>
    </>
  );
}

function WhereItGoes({
  inPath,
  onInPath,
  pathId,
  moduleId,
  onPick,
}: {
  inPath: boolean;
  onInPath: (v: boolean) => void;
  pathId: string;
  moduleId: string;
  onPick: (pathId: string, moduleId: string) => void;
}) {
  const paths = useLoad("paths-all", (signal) => listPaths("all", signal));
  const [doc, setDoc] = useState<PathDoc | null>(null);
  const [docFailed, setDocFailed] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only reload on path change
  useEffect(() => {
    if (!pathId) {
      setDoc(null);
      return;
    }
    let live = true;
    setDocFailed(false);
    getPath(pathId).then((r) => {
      if (!live) return;
      if (r.ok) {
        setDoc(r.data);
        if (!r.data.modules.some((m) => m.id === moduleId))
          onPick(pathId, r.data.modules[0]?.id ?? "");
      } else setDocFailed(true);
    });
    return () => {
      live = false;
    };
  }, [pathId]);

  const rows: PathRow[] =
    paths.load.state === "ready"
      ? paths.load.data.items.filter((p) => p.status !== "unpublished")
      : [];

  return (
    <Panel title="Where it goes">
      <div className="flex flex-col gap-4">
        <Radio
          name="where"
          checked={!inPath}
          onChange={() => onInPath(false)}
          label="Library only"
          hint="Learners find it by browsing or searching"
        />
        <Radio
          name="where"
          checked={inPath}
          onChange={() => onInPath(true)}
          label="Library and a path"
          hint="Also add it as a lesson"
        >
          {inPath ? (
            paths.load.state === "error" ? (
              <p role="alert" className="text-[13px] text-error-text">
                We couldn’t load paths.{" "}
                <button type="button" className="underline" onClick={paths.reload}>
                  Try again
                </button>
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Path">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={pathId}
                      disabled={paths.load.state === "loading"}
                      onChange={(e) => onPick(e.target.value, "")}
                    >
                      <option value="">
                        {rows.length === 0 && paths.load.state === "ready"
                          ? "No paths yet"
                          : "Choose a path"}
                      </option>
                      {rows.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field
                  label="Module"
                  error={docFailed ? "We couldn’t load that path’s modules." : null}
                  hint={
                    doc && doc.modules.length === 0
                      ? "This path has no modules yet. Add one in the path editor first."
                      : undefined
                  }
                >
                  {({ id, describedBy }) => (
                    <Select
                      id={id}
                      aria-describedby={describedBy}
                      value={moduleId}
                      disabled={!doc || doc.modules.length === 0}
                      onChange={(e) => onPick(pathId, e.target.value)}
                    >
                      {(doc?.modules ?? []).map((m, i) => (
                        <option key={m.id} value={m.id}>
                          {i + 1}. {m.title}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            )
          ) : null}
        </Radio>
      </div>
    </Panel>
  );
}

/** /resources/edit?id= (RS8, 639:15540). Link changes go through "Fix link", not here. */
export function EditResourceScreen() {
  const id = useSearchParams().get("id");
  const { load, reload } = useLoad(`edit-${id}`, (signal) =>
    id
      ? getResource(id, signal)
      : Promise.resolve({ ok: false as const, code: "not_found", message: "" }),
  );
  const showSkeleton = useSkeletonGate(load.state === "loading");
  return (
    <PageFrame>
      <BackLink href={id ? `/resources/detail?id=${encodeURIComponent(id)}` : "/resources"}>
        {load.state === "ready" ? load.data.title : "Resources"}
      </BackLink>
      {load.state === "loading" ? (
        <div className="mt-4" role="status" aria-label="Loading the resource">
          <h1 className="sr-only">Edit resource</h1>
          {showSkeleton ? <Skeleton className="h-72 w-full" /> : null}
        </div>
      ) : load.state === "error" ? (
        <>
          <h1 className="sr-only">Edit resource</h1>
          <StateMessage
            tone="error"
            title="We couldn’t load this resource"
            body={load.failure.message || "Try again in a moment."}
            action={<Button onClick={reload}>Try again</Button>}
          />
        </>
      ) : (
        <EditForm resource={load.data} />
      )}
    </PageFrame>
  );
}

function EditForm({ resource: r }: { resource: ResourceDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>({
    url: r.url,
    title: r.title,
    creator: r.creator,
    source: r.source,
    type: r.type,
    topic: r.topic,
    level: r.level,
    license: r.license,
    minutes: r.durationMin ? String(r.durationMin) : "",
    intro: r.intro,
    learningGoal: r.learningGoal,
    tags: r.tags,
    thumbnail: r.thumbnail,
  });
  const [errors, setErrors] = useState<DraftErrors>({});
  const [busy, setBusy] = useState(false);
  const livePaths = r.usedIn.filter((u) => u.pathStatus === "live");
  const publishing = r.status === "live";

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function save() {
    const found = validate(draft, publishing);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast({ tone: "error", title: "Check the highlighted fields" });
      return;
    }
    setBusy(true);
    const { url: _url, ...rest } = toInput(draft, publishing ? "live" : "draft", "free_public");
    const { rights: _rights, status: _status, ...patch } = rest;
    const result = await updateResource(r.id, patch);
    setBusy(false);
    if (!result.ok) {
      toast({
        tone: "error",
        title: "Couldn’t save changes",
        body: result.message,
        action: { label: "Try again", run: save },
      });
      return;
    }
    router.push(`/resources/detail?id=${encodeURIComponent(r.id)}&notice=saved`);
  }

  return (
    <>
      <PageHeader
        title="Edit resource"
        subtitle={r.url}
        actions={
          <>
            <ButtonLink href={`/resources/detail?id=${encodeURIComponent(r.id)}`}>
              Cancel
            </ButtonLink>
            <Button kind="primary" onClick={save} busy={busy}>
              Save changes
            </Button>
          </>
        }
      />
      {livePaths.length > 0 ? (
        <div className="mt-5">
          <Banner tone="info">
            Used in {plural(livePaths.length, "live path")} (
            {[...new Set(livePaths.map((u) => u.pathTitle))].join(", ")}). Learners see changes
            straight away.
          </Banner>
        </div>
      ) : null}
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <RecordFields draft={draft} errors={errors} onChange={change} />
          <LearnerFields draft={draft} errors={errors} onChange={change} />
        </div>
        <LearnerPreview draft={draft} />
      </div>
    </>
  );
}
