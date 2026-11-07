"use client";

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { listSubmissions, type Submission } from "../../lib/auth/submissions-api";
import { FOCUS } from "../app/ui";
import { PageHeader } from "../app-help/fields";
import { Banner, StatusRegion } from "../auth/banner";
import { MySubmissions, type SubmissionsState } from "./my-submissions";
import { SubmitForm } from "./submit-form";

/**
 * /learn/submit. Two tabs, like the Figma "Library tabs": the form (default) and My submissions.
 * Sending a resource moves to My submissions with a confirmation (Figma 5 "Submitted, in review");
 * "Edit and resubmit" on a row that needs a change opens the form for that submission (Figma 8).
 * The form is a card here rather than the Figma dialog over the Library; see submit-form.tsx.
 */
type Tab = "submit" | "mine";
type Notice = { title: string; description: string };

const TABS: { id: Tab; label: string }[] = [
  { id: "submit", label: "Submit a resource" },
  { id: "mine", label: "My submissions" },
];

export function SubmitScreen() {
  const [tab, setTab] = useState<Tab>("submit");
  const [editing, setEditing] = useState<Submission | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [list, setList] = useState<SubmissionsState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ submit: null, mine: null });

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load on purpose
  useEffect(() => {
    const controller = new AbortController();
    setList((current) => (current.status === "ready" ? current : { status: "loading" }));
    listSubmissions(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setList(result.ok ? { status: "ready", rows: result.data } : { status: "error" });
    });
    return () => controller.abort();
  }, [reload]);

  const select = useCallback((next: Tab) => {
    setTab(next);
    setEditing(null);
    if (next === "submit") setNotice(null);
  }, []);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length];
    if (!next) return;
    select(next.id);
    tabRefs.current[next.id]?.focus();
  }

  function done(submission: Submission, kind: "new" | "edit") {
    setEditing(null);
    setTab("mine");
    setNotice(
      kind === "new"
        ? {
            title: "Submitted for review",
            description: "A curator will look at it. Check back here to see where it stands.",
          }
        : {
            title: "Resubmitted for review",
            description: "Thanks for the update. A curator will take another look.",
          },
    );
    setList((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            rows: [submission, ...current.rows.filter((row) => row.id !== submission.id)],
          }
        : current,
    );
    setReload((n) => n + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <PageHeader
        title="Submit a resource"
        description="Share a free video, article or tool. A curator reviews every submission."
      />

      <div
        role="tablist"
        aria-label="Submit a resource"
        className="flex w-fit gap-1 rounded-xl bg-bg-fill1 p-1"
      >
        {TABS.map((item, index) => (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[item.id] = el;
            }}
            type="button"
            role="tab"
            id={`submit-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`submit-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => select(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`h-8 rounded-lg px-3 font-medium text-[14px] leading-5 tracking-[-0.14px] ${FOCUS} ${
              tab === item.id
                ? "bg-bg-base text-text shadow-e1"
                : "text-text-secondary hover:text-text"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <StatusRegion>
        {notice ? (
          <div className="max-w-[560px]">
            <Banner tone="success" title={notice.title} onDismiss={() => setNotice(null)}>
              {notice.description}
            </Banner>
          </div>
        ) : null}
      </StatusRegion>

      {tab === "submit" ? (
        <div role="tabpanel" id="submit-panel-submit" aria-labelledby="submit-tab-submit">
          <SubmitForm
            mode={{ kind: "new" }}
            onDone={done}
            onCancel={() => select("mine")}
            onShowMine={() => select("mine")}
          />
        </div>
      ) : (
        <div role="tabpanel" id="submit-panel-mine" aria-labelledby="submit-tab-mine">
          {editing ? (
            <SubmitForm
              key={editing.id}
              mode={{ kind: "edit", submission: editing }}
              onDone={done}
              onCancel={() => setEditing(null)}
              onShowMine={() => setEditing(null)}
            />
          ) : (
            <MySubmissions
              state={list}
              onRetry={() => setReload((n) => n + 1)}
              onEdit={(submission) => {
                setNotice(null);
                setEditing(submission);
              }}
              onSubmitNew={() => select("submit")}
            />
          )}
        </div>
      )}
    </div>
  );
}
