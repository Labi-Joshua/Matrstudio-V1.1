"use client";

import { useSearchParams } from "next/navigation";
import { previewPath } from "../../lib/content/api";
import { durationLabel, metaLine, plural } from "../../lib/content/format";
import { LEVEL_OPTIONS, labelOf } from "../../lib/content/options";
import { countLessons } from "../../lib/content/reorder";
import type { PathDoc } from "../../lib/content/types";
import { useLoad, useSkeletonGate } from "./hooks";
import {
  BackLink,
  Badge,
  Banner,
  Button,
  ButtonLink,
  PageFrame,
  Skeleton,
  StateMessage,
  Thumb,
  TYPE_LABEL,
} from "./ui";

/** PT10 (649:10002): the learner's path page, read-only. Nothing here saves progress or counts in metrics. */
export function PathPreviewScreen() {
  const id = useSearchParams().get("id");
  const { load, reload } = useLoad(`preview-${id}`, (signal) =>
    id
      ? previewPath(id, signal)
      : Promise.resolve({ ok: false as const, code: "not_found", message: "" }),
  );
  const showSkeleton = useSkeletonGate(load.state === "loading");
  const back = id ? `/paths/edit?id=${encodeURIComponent(id)}` : "/paths";
  return (
    <PageFrame>
      <BackLink href={back}>Back to the editor</BackLink>
      <div className="mt-4">
        {load.state === "loading" ? (
          <div role="status" aria-label="Loading the preview">
            <h1 className="sr-only">Path preview</h1>
            {showSkeleton ? <Skeleton className="h-96 w-full" /> : null}
          </div>
        ) : load.state === "error" ? (
          <>
            <h1 className="sr-only">Path preview</h1>
            <StateMessage
              tone="error"
              title="We couldn’t load the preview"
              body={load.failure.message || "Try again in a moment."}
              action={
                <div className="flex gap-2">
                  <Button onClick={reload}>Try again</Button>
                  <ButtonLink href={back}>Back to the editor</ButtonLink>
                </div>
              }
            />
          </>
        ) : (
          <Preview path={load.data} />
        )}
      </div>
    </PageFrame>
  );
}

function Preview({ path }: { path: PathDoc }) {
  const lessons = path.modules.flatMap((m) => m.lessons);
  const minutes = lessons.reduce((n, l) => n + (l.durationMin ?? 0), 0);
  return (
    <div className="flex flex-col gap-6">
      <Banner tone="info">
        Viewing {path.title} as a learner. Nothing you do here saves progress or counts in metrics.
      </Banner>
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8">
        <Thumb src={path.coverUrl} className="aspect-[3/1] w-full" />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge>{labelOf(LEVEL_OPTIONS, path.level)}</Badge>
            {path.topic ? <Badge>{path.topic}</Badge> : null}
            {path.time ? <Badge>{path.time}</Badge> : null}
          </div>
          <h1 className="font-medium text-[32px] leading-10 tracking-[-0.64px]">{path.title}</h1>
          {path.description ? (
            <p className="text-[16px] text-text-secondary leading-6">{path.description}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="h-10 cursor-not-allowed rounded-xl bg-ink px-4 font-medium text-[14px] text-bg-base opacity-60"
            >
              Start path
            </button>
            <button
              type="button"
              disabled
              className="h-10 cursor-not-allowed rounded-xl border border-border px-4 font-medium text-[14px] opacity-60"
            >
              Star path
            </button>
          </div>
        </div>
        {path.outcomes.length > 0 ? (
          <section>
            <h2 className="mb-2 font-medium text-[18px]">What you’ll learn</h2>
            <ul className="list-disc space-y-1 pl-5 text-[14px] leading-5">
              {path.outcomes.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <section>
          <h2 className="mb-1 font-medium text-[18px]">Lessons</h2>
          <p className="mb-3 text-[14px] text-text-secondary">
            {plural(countLessons(path.modules), "lesson")}
            {minutes > 0 ? ` · about ${durationLabel(minutes)}` : ""}
          </p>
          {lessons.length === 0 ? (
            <p className="text-[14px] text-text-tertiary">No lessons yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {path.modules.map((m, mi) => (
                <div key={m.id}>
                  <h3 className="mb-2 font-medium text-[14px] text-text-secondary">
                    Module {mi + 1} · {m.title}
                  </h3>
                  <ol className="flex flex-col gap-2">
                    {m.lessons.map((l) => (
                      <li key={l.id} className="rounded-xl border border-border-soft p-3">
                        <p className="font-medium text-[14px] leading-5">{l.title}</p>
                        <p className="text-[12px] text-text-tertiary leading-4">
                          {metaLine([
                            TYPE_LABEL[l.type],
                            l.source,
                            durationLabel(l.durationMin, l.type),
                          ])}
                        </p>
                        {l.intro ? (
                          <p className="mt-1 text-[13px] text-text-secondary leading-5">
                            {l.intro}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </section>
        {path.audience.length > 0 ? (
          <section>
            <h2 className="mb-2 font-medium text-[18px]">Who it’s for</h2>
            <ul className="list-disc space-y-1 pl-5 text-[14px] leading-5">
              {path.audience.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
