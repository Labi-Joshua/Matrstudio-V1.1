"use client";

import { useEffect, useRef, useState } from "react";
import { trapTarget } from "../../lib/app/submit-dialog";
import { submittedNotice } from "../../lib/app/submit-state";
import type { Submission } from "../../lib/auth/submissions-api";
import { UploadIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { Banner, StatusRegion } from "../auth/banner";
import { XIcon } from "../auth/icons";
import { MySubmissions } from "./my-submissions";
import { SubmitForm } from "./submit-form";
import { useSubmissions } from "./use-submissions";

/**
 * The Submit a resource dialog (Figma 1 to 9 dialog frames), opened from the top bar. Self
 * contained: render `<SubmitDialog open onClose />` anywhere inside the app shell. A centered
 * 560px dialog on desktop and tablet, a full-height sheet on phones. It has three views, the form
 * (default), the confirmation after sending (which is My submissions with a notice) and "Edit and
 * resubmit" for a row that needs a change. /learn/submit is the full-page version of the same form.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type View = "form" | "mine";

export function SubmitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <Dialog onClose={onClose} /> : null;
}

function Dialog({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("form");
  const [editing, setEditing] = useState<Submission | null>(null);
  const [notice, setNotice] = useState<ReturnType<typeof submittedNotice> | null>(null);
  const { list, reload, added } = useSubmissions(view === "mine");

  // Modal behaviour: focus in, trapped, Escape, scroll lock, focus back to the trigger.
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>("input, select, textarea") ?? panel)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const active = items.indexOf(document.activeElement as HTMLElement);
      const target = trapTarget(items.length, active, event.shiftKey);
      if (target === null) return;
      event.preventDefault();
      items[target]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [onClose]);

  function show(next: View) {
    setView(next);
    setEditing(null);
    if (next === "form") setNotice(null);
  }

  function done(submission: Submission, kind: "new" | "edit") {
    setEditing(null);
    setView("mine");
    setNotice(submittedNotice(kind));
    added(submission);
  }

  const heading = editing
    ? "Edit and resubmit"
    : view === "mine"
      ? "My submissions"
      : "Submit a resource";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center md:items-center md:p-6">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-static-black/60 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-dialog-title"
        tabIndex={-1}
        className="relative flex w-full flex-col overflow-hidden bg-bg-base outline-none md:max-h-full md:max-w-[560px] md:rounded-3xl md:border md:border-border md:shadow-card"
      >
        <div className="flex shrink-0 items-start gap-4 border-border-soft border-b border-dashed p-5 md:px-8 md:pt-8 md:pb-6">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border border-dashed bg-bg-fill1 text-text-secondary"
          >
            <UploadIcon size={24} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2
              id="submit-dialog-title"
              className="font-medium text-[18px] text-text leading-7 tracking-[-0.18px]"
            >
              {heading}
            </h2>
            <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              Share a free video, article or tool. A curator reviews every submission.
            </p>
            {!editing ? (
              <button
                type="button"
                onClick={() => show(view === "form" ? "mine" : "form")}
                className={`mt-1 w-fit rounded-sm font-medium text-[14px] text-primary-text leading-5 hover:underline ${FOCUS}`}
              >
                {view === "form" ? "My submissions" : "Submit a resource"}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`flex size-8 shrink-0 items-center justify-center rounded-md bg-bg-fill1 text-text-secondary hover:text-text ${FOCUS}`}
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 md:px-8 md:pt-6 md:pb-8">
          <StatusRegion>
            {notice ? (
              <Banner tone="success" title={notice.title} onDismiss={() => setNotice(null)}>
                {notice.description}
              </Banner>
            ) : null}
          </StatusRegion>
          {view === "form" ? (
            <SubmitForm
              bare
              mode={{ kind: "new" }}
              onDone={done}
              onCancel={onClose}
              onShowMine={() => show("mine")}
            />
          ) : editing ? (
            <SubmitForm
              bare
              key={editing.id}
              mode={{ kind: "edit", submission: editing }}
              onDone={done}
              onCancel={() => setEditing(null)}
              onShowMine={() => setEditing(null)}
            />
          ) : (
            <MySubmissions
              state={list}
              onRetry={reload}
              onEdit={(submission) => {
                setNotice(null);
                setEditing(submission);
              }}
              onSubmitNew={() => show("form")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
