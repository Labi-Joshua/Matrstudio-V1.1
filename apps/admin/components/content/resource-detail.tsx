"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { getResource } from "../../lib/content/api";
import {
  dateTimeLabel,
  durationLabel,
  metaLine,
  plural,
  relativeDay,
} from "../../lib/content/format";
import { LEVEL_OPTIONS, labelOf, TYPE_OPTIONS } from "../../lib/content/options";
import type { ResourceDetail } from "../../lib/content/types";
import { FixLinkModal } from "./fix-link-modal";
import { useLoad, useSkeletonGate } from "./hooks";
import { StatusBadge } from "./resources-list";
import { RetireModal } from "./retire-modal";
import { useNotice, useToast } from "./toast";
import {
  BackLink,
  Button,
  ButtonLink,
  ChipTabs,
  FOCUS,
  PageFrame,
  PageHeader,
  Panel,
  Skeleton,
  StateMessage,
  TrashIcon,
} from "./ui";

export function ResourceDetailScreen() {
  const id = useSearchParams().get("id");
  if (!id)
    return (
      <PageFrame>
        <h1 className="sr-only">Resource</h1>
        <StateMessage
          title="No resource chosen"
          body="Open a resource from the list."
          action={<ButtonLink href="/resources">Back to resources</ButtonLink>}
        />
      </PageFrame>
    );
  return <Loaded id={id} />;
}

function Loaded({ id }: { id: string }) {
  const { load, reload } = useLoad(`resource-${id}`, (signal) => getResource(id, signal));
  const showSkeleton = useSkeletonGate(load.state === "loading");
  return (
    <PageFrame>
      <BackLink href="/resources">Resources</BackLink>
      <div className="mt-4">
        {load.state === "loading" ? (
          showSkeleton ? (
            <div role="status" aria-label="Loading the resource" className="space-y-4">
              <h1 className="sr-only">Resource</h1>
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-4 w-48" />
              <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-56" />
                <Skeleton className="h-56" />
              </div>
            </div>
          ) : (
            <h1 className="sr-only">Resource</h1>
          )
        ) : load.state === "error" ? (
          <>
            <h1 className="sr-only">Resource</h1>
            <StateMessage
              tone="error"
              title={
                load.failure.code === "not_found"
                  ? "That resource doesn’t exist"
                  : "We couldn’t load this resource"
              }
              body={
                load.failure.code === "not_found"
                  ? "It may have been removed. Go back to the list."
                  : load.failure.message
              }
              action={
                load.failure.code === "not_found" ? (
                  <ButtonLink href="/resources">Back to resources</ButtonLink>
                ) : (
                  <Button onClick={reload}>Try again</Button>
                )
              }
            />
          </>
        ) : (
          <Detail resource={load.data} onChanged={reload} />
        )}
      </div>
    </PageFrame>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2 text-[14px] leading-5 sm:grid-cols-[140px_1fr]">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Detail({ resource: r, onChanged }: { resource: ResourceDetail; onChanged: () => void }) {
  const toast = useToast();
  useNotice({ published: "Resource published", saved: "Changes saved" });
  const [tab, setTab] = useState<"overview" | "paths">("overview");
  const [retiring, setRetiring] = useState(false);
  const [fixing, setFixing] = useState(false);
  const retired = r.status === "retired";
  const check = r.linkCheck;

  return (
    <>
      <PageHeader
        title={r.title}
        badge={<StatusBadge status={r.status} />}
        subtitle={metaLine([r.source, r.creator, durationLabel(r.durationMin, r.type)])}
        actions={
          retired ? null : (
            <>
              {r.status === "needs_fix" ? (
                <Button kind="primary" onClick={() => setFixing(true)}>
                  Fix link
                </Button>
              ) : null}
              <Button kind="dangerOutline" onClick={() => setRetiring(true)}>
                <TrashIcon />
                Retire
              </Button>
              <ButtonLink
                href={`/resources/edit?id=${encodeURIComponent(r.id)}`}
                kind={r.status === "needs_fix" ? "secondary" : "primary"}
              >
                Edit
              </ButtonLink>
            </>
          )
        }
      />

      <div className="mt-5">
        <ChipTabs
          label="Resource sections"
          value={tab}
          onChange={setTab}
          items={[
            { value: "overview", label: "Overview" },
            { value: "paths", label: `Used in ${plural(r.usedIn.length, "path")}` },
          ]}
        />
      </div>

      {tab === "overview" ? (
        <div className="mt-5 flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Record" className="bg-bg-base">
              <dl className="divide-y divide-border-soft">
                <Row label="Type">{labelOf(TYPE_OPTIONS, r.type)}</Row>
                <Row label="Topic">{r.topic || "—"}</Row>
                <Row label="Level">{labelOf(LEVEL_OPTIONS, r.level)}</Row>
                <Row label="License">{r.license || "—"}</Row>
                <Row label="Link">
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`break-all rounded-sm underline ${FOCUS}`}
                    >
                      {r.url}
                    </a>
                  ) : (
                    "—"
                  )}
                </Row>
                {r.tags.length > 0 ? <Row label="Tags">{r.tags.join(", ")}</Row> : null}
                <Row label="Added by">
                  {metaLine([r.addedBy, r.addedAt ? relativeDay(r.addedAt) : null]) || "—"}
                </Row>
              </dl>
            </Panel>
            <Panel title="Learners · last 30 days" className="bg-bg-base">
              <dl className="divide-y divide-border-soft">
                <Row label="Opened">{r.stats30d.opened.toLocaleString("en")}</Row>
                <Row label="Saved">{r.stats30d.saved.toLocaleString("en")}</Row>
                <Row label="Marked done">{r.stats30d.done.toLocaleString("en")}</Row>
                <Row label="Broken link reports">
                  {r.stats30d.brokenReports.toLocaleString("en")}
                </Row>
                <Row label="Last link check">
                  {check.at ? (
                    <span className={check.ok ? "" : "text-error-text"}>
                      {dateTimeLabel(check.at)} · {check.ok ? "OK" : (check.reason ?? "Failed")}
                    </span>
                  ) : (
                    "Not checked yet"
                  )}
                </Row>
              </dl>
            </Panel>
          </div>
          <Panel title="Intro shown to learners" className="bg-bg-base">
            {r.intro ? (
              <p className="whitespace-pre-wrap text-[14px] leading-5">{r.intro}</p>
            ) : (
              <p className="text-[14px] text-text-tertiary leading-5">No intro written yet.</p>
            )}
            {r.learningGoal ? (
              <p className="mt-3 text-[13px] text-text-secondary leading-5">
                Learning goal: {r.learningGoal}
              </p>
            ) : null}
          </Panel>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border-soft">
          {r.usedIn.length === 0 ? (
            <StateMessage
              title="Library only"
              body="This resource isn’t a lesson in any path yet."
            />
          ) : (
            <ul className="divide-y divide-border-soft">
              {r.usedIn.map((u) => (
                <li
                  key={`${u.pathId}-${u.moduleNumber}-${u.lessonNumber}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-[14px]"
                >
                  <Link
                    href={`/paths/edit?id=${encodeURIComponent(u.pathId)}`}
                    className={`rounded-sm font-medium hover:underline ${FOCUS}`}
                  >
                    {u.pathTitle}
                  </Link>
                  <span className="text-text-secondary">
                    Module {u.moduleNumber} · Lesson {u.lessonNumber} · {u.pathStatus}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {retiring ? (
        <RetireModal
          resource={r}
          onClose={() => setRetiring(false)}
          onDone={() => {
            setRetiring(false);
            toast({ tone: "success", title: "Resource retired" });
            onChanged();
          }}
        />
      ) : null}
      {fixing ? (
        <FixLinkModal
          resourceId={r.id}
          title={r.title}
          onClose={() => setFixing(false)}
          onDone={(message) => {
            setFixing(false);
            toast({ tone: "success", title: message });
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}
