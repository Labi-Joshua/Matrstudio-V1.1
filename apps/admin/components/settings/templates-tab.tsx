"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listTemplates, saveTemplate, sendTestEmail } from "../../lib/settings/api";
import {
  insertVariable,
  isDirty,
  renderTemplate,
  unknownVariables,
} from "../../lib/settings/logic";
import type { EmailTemplate } from "../../lib/settings/types";
import { useToast } from "./overlay";
import {
  BAR,
  LoadError,
  SkeletonFrame,
  saveFailureText,
  useLoaded,
  useSkeletonGate,
} from "./state";
import type { TabProps } from "./tab-props";
import { BTN_PRIMARY, Button, FOCUS, INPUT, LABEL, MailIcon, TEXTAREA } from "./ui";

type Draft = { subject: string; body: string };

function Skeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3 rounded-2xl border border-border-soft p-5">
        {["a", "b", "c", "d", "e", "f"].map((k) => (
          <div key={k} className={`${BAR} h-10`} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-2xl bg-bg-fill1 p-5">
          <div className={`${BAR} h-4 w-32`} />
          <div className={`${BAR} h-10`} />
          <div className={`${BAR} h-24`} />
        </div>
        <div className={`${BAR} h-40 rounded-2xl`} />
      </div>
    </div>
  );
}

export function TemplatesTab({ canEdit, actions, onDirty }: TabProps) {
  const toast = useToast();
  const id = useId();
  const { state, reload, set } = useLoaded((signal) => listTemplates({ signal }));
  const showSkeleton = useSkeletonGate(state.status === "loading");
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<"subject" | "body">("body");
  const templates = state.status === "ready" ? state.data : [];
  const current = templates.find((t) => t.key === selected) ?? templates[0];
  const draft: Draft | undefined = current
    ? (drafts[current.key] ?? { subject: current.subject, body: current.body })
    : undefined;

  const dirtyKeys = templates.filter((t) => {
    const d = drafts[t.key];
    return d && isDirty({ subject: t.subject, body: t.body }, d);
  });
  const dirty = dirtyKeys.length > 0;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);

  const unknown =
    current && draft ? unknownVariables(`${draft.subject} ${draft.body}`, current.variables) : [];
  const currentDirty =
    current && draft ? isDirty({ subject: current.subject, body: current.body }, draft) : false;

  function edit(patch: Partial<Draft>) {
    if (!current || !draft) return;
    setDrafts((d) => ({ ...d, [current.key]: { ...draft, ...patch } }));
  }

  function insert(name: string) {
    if (!draft || !canEdit) return;
    const field = lastField.current;
    const el = field === "subject" ? subjectRef.current : bodyRef.current;
    const text = draft[field];
    const out = insertVariable(
      text,
      el?.selectionStart ?? text.length,
      el?.selectionEnd ?? text.length,
      name,
    );
    edit({ [field]: out.text });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(out.caret, out.caret);
    });
  }

  async function save() {
    if (!current || !draft || saving || !currentDirty) return;
    if (unknown.length > 0) {
      toast({
        tone: "error",
        title: "Couldn’t save",
        body: `Remove or fix {${unknown[0]}} first.`,
      });
      return;
    }
    setSaving(true);
    const result = await saveTemplate(current.key, draft);
    setSaving(false);
    if (result.ok) {
      const next: EmailTemplate = { ...current, ...result.data };
      set((list) => list.map((t) => (t.key === next.key ? next : t)));
      setDrafts((d) => {
        const { [current.key]: _gone, ...rest } = d;
        return rest;
      });
      toast({ tone: "success", title: "Template saved", body: `“${next.name}” is updated.` });
    } else toast({ tone: "error", title: "Couldn’t save", body: saveFailureText(result) });
  }

  async function test() {
    if (!current || !draft || testing) return;
    if (unknown.length > 0) {
      toast({
        tone: "error",
        title: "Test email didn’t send",
        body: "Check the template for a missing variable and try again.",
      });
      return;
    }
    setTesting(true);
    const result = await sendTestEmail(current.key, draft);
    setTesting(false);
    if (result.ok)
      toast({
        tone: "success",
        title: "Test email sent",
        body: "Check your inbox. It uses sample data.",
      });
    else
      toast({
        tone: "error",
        title: "Test email didn’t send",
        body:
          result.code === "network_error" || result.code === "rate_limited"
            ? saveFailureText(result)
            : "Check the template for a missing variable and try again.",
      });
  }

  const header =
    state.status === "ready" && current ? (
      <div className="flex items-center gap-2">
        {canEdit ? (
          <>
            <Button variant="secondary" onClick={test} busy={testing}>
              <MailIcon size={16} />
              Send test to me
            </Button>
            <Button onClick={save} busy={saving} disabled={!currentDirty}>
              Save
            </Button>
          </>
        ) : null}
      </div>
    ) : null;

  const previewSubject = draft ? renderTemplate(draft.subject) : "";
  const previewBody = draft ? renderTemplate(draft.body) : "";

  return (
    <div>
      {actions && header ? createPortal(header, actions) : null}
      {state.status === "loading" ? (
        <SkeletonFrame label="Loading email templates" visible={showSkeleton}>
          <Skeleton />
        </SkeletonFrame>
      ) : state.status === "error" ? (
        <LoadError what="email templates" failure={state.failure} onRetry={reload} />
      ) : !current || !draft ? (
        <p className="rounded-2xl border border-border-soft border-dashed px-6 py-16 text-center text-[14px] text-text-secondary">
          No email templates are set up yet.
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <nav aria-label="Templates" className="rounded-2xl border border-border-soft p-3">
            <h2 className="px-3 pt-2 pb-3 font-medium text-[14px] text-text leading-5">
              Templates
            </h2>
            <ul className="flex flex-col gap-0.5">
              {templates.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => setSelected(t.key)}
                    aria-current={t.key === current.key ? "true" : undefined}
                    className={`flex w-full flex-col rounded-lg px-3 py-2 text-left ${FOCUS} ${t.key === current.key ? "bg-bg-fill1" : "hover:bg-bg-fill1"}`}
                  >
                    <span className="flex items-center gap-2 text-[14px] text-text leading-5">
                      {t.name}
                      {dirtyKeys.some((k) => k.key === t.key) ? (
                        <span
                          className="size-1.5 rounded-full bg-primary"
                          role="img"
                          aria-label="Unsaved changes"
                        />
                      ) : null}
                    </span>
                    {t.when ? (
                      <span className="text-[12px] text-text-tertiary leading-4">{t.when}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex min-w-0 flex-col gap-4">
            <section
              className="flex flex-col gap-4 rounded-2xl bg-bg-fill1 p-5"
              aria-label={`Edit ${current.name}`}
            >
              <h2 className="font-medium text-[14px] text-text leading-5">{current.name}</h2>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-s`} className={LABEL}>
                  Subject
                </label>
                <input
                  id={`${id}-s`}
                  ref={subjectRef}
                  value={draft.subject}
                  readOnly={!canEdit}
                  maxLength={200}
                  onFocus={() => {
                    lastField.current = "subject";
                  }}
                  onChange={(event) => edit({ subject: event.target.value })}
                  className={INPUT}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-b`} className={LABEL}>
                  Message
                </label>
                <textarea
                  id={`${id}-b`}
                  ref={bodyRef}
                  value={draft.body}
                  readOnly={!canEdit}
                  maxLength={5000}
                  rows={5}
                  onFocus={() => {
                    lastField.current = "body";
                  }}
                  onChange={(event) => edit({ body: event.target.value })}
                  aria-describedby={unknown.length > 0 ? `${id}-unknown` : undefined}
                  className={TEXTAREA}
                />
              </div>
              {unknown.length > 0 ? (
                <p
                  id={`${id}-unknown`}
                  role="alert"
                  className="text-[13px] text-error-text leading-5"
                >
                  {unknown.map((u) => `{${u}}`).join(", ")}{" "}
                  {unknown.length === 1 ? "isn’t" : "aren’t"} a variable this email can use.
                </p>
              ) : null}
              {canEdit && current.variables.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-text-tertiary">Insert:</span>
                  {current.variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insert(v)}
                      aria-label={`Insert ${v}`}
                      className={`rounded-md border border-border-soft bg-bg-base px-2 py-0.5 font-mono text-[12px] text-text-secondary leading-4 hover:text-text ${FOCUS}`}
                    >
                      {`{${v}}`}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
            <section
              className="flex flex-col gap-2 rounded-2xl border border-border-soft p-5"
              aria-label="Preview"
            >
              <h2 className="text-[12px] text-text-tertiary leading-4">Preview</h2>
              <p className="font-medium text-[14px] text-text leading-5">{previewSubject}</p>
              <p className="whitespace-pre-wrap text-[14px] text-text-secondary leading-5">
                {previewBody}
              </p>
              {current.cta ? (
                <span aria-hidden="true" className={`${BTN_PRIMARY} mt-2 self-start`}>
                  {current.cta}
                </span>
              ) : null}
              <p className="text-[12px] text-text-tertiary leading-4">
                Sample data: Ada, UI/UX Foundations.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
