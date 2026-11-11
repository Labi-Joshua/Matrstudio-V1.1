"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { getNudgeRules, putNudgeRules } from "../../lib/settings/api";
import {
  dayLabel,
  FIRST_NUDGE_DAYS,
  isDirty,
  MAX_PER_WEEK,
  nudgeError,
  nudgeTimeline,
  perWeekLabel,
  SECOND_NUDGE_DAYS,
  withCurrent,
} from "../../lib/settings/logic";
import type { NudgeRules } from "../../lib/settings/types";
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
import { Button, CARD, Checkbox, Field, MailIcon, Note, PANEL, Select, Switch } from "./ui";

const asOptions = (values: number[], label: (n: number) => string) =>
  values.map((n) => ({ value: String(n), label: label(n) }));

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className={`${BAR} h-56 rounded-2xl`} />
      <div className={`${BAR} h-36 rounded-2xl`} />
    </div>
  );
}

export function NudgesTab({ canEdit, actions, onDirty }: TabProps) {
  const toast = useToast();
  const id = useId();
  const { state, reload, set } = useLoaded((signal) => getNudgeRules({ signal }));
  const showSkeleton = useSkeletonGate(state.status === "loading");
  const [draft, setDraft] = useState<NudgeRules | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = state.status === "ready" ? state.data : null;
  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);
  const dirty = saved !== null && draft !== null && isDirty(saved, draft);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  const problem = draft ? nudgeError(draft.firstAfterDays, draft.secondAfterDays) : null;

  async function save() {
    if (!draft || saving || !dirty) return;
    if (problem) {
      toast({ tone: "error", title: "Couldn’t save", body: problem });
      return;
    }
    setSaving(true);
    const result = await putNudgeRules(draft);
    setSaving(false);
    if (result.ok) {
      set(() => result.data);
      setDraft(result.data);
      toast({
        tone: "success",
        title: "Settings saved",
        body: "Nudge rules apply from the next send.",
      });
    } else toast({ tone: "error", title: "Couldn’t save", body: saveFailureText(result) });
  }

  const header =
    canEdit && state.status === "ready" ? (
      <Button onClick={save} busy={saving} disabled={!dirty}>
        Save changes
      </Button>
    ) : null;
  const patch = (p: Partial<NudgeRules>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <div>
      {actions && header ? createPortal(header, actions) : null}
      {state.status === "loading" ? (
        <SkeletonFrame label="Loading nudge rules" visible={showSkeleton}>
          <Skeleton />
        </SkeletonFrame>
      ) : state.status === "error" ? (
        <LoadError what="nudge rules" failure={state.failure} onRetry={reload} />
      ) : draft ? (
        <div className="flex flex-col gap-4">
          <section className={`${PANEL} flex flex-col gap-4 p-5`} aria-labelledby={`${id}-t`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={`${id}-t`} className="font-medium text-[14px] text-text leading-5">
                  Continue learning reminders
                </h2>
                <p className="text-[12px] text-text-tertiary leading-4">
                  For learners who started a path and stopped.
                </p>
              </div>
              <Switch
                checked={draft.enabled}
                disabled={!canEdit}
                label="Continue learning reminders"
                onChange={(enabled) => patch({ enabled })}
              />
            </div>
            <ol
              aria-label="What happens, in order"
              className={`flex flex-wrap items-center gap-2 text-[12px] leading-4 ${draft.enabled ? "" : "opacity-50"}`}
            >
              {nudgeTimeline(draft.firstAfterDays, draft.secondAfterDays).map((step, i, all) => (
                <li key={step} className="flex items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-1 font-medium ${i === 1 || i === 2 ? "bg-success-focus text-success-text" : i === 0 ? "bg-success-focus text-success-text" : "text-text-secondary"}`}
                  >
                    {step}
                  </span>
                  {i < all.length - 1 ? (
                    <span aria-hidden="true" className="text-text-tertiary">
                      →
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="First nudge after" htmlFor={`${id}-first`}>
                <Select
                  id={`${id}-first`}
                  value={String(draft.firstAfterDays)}
                  disabled={!canEdit}
                  options={asOptions(withCurrent(FIRST_NUDGE_DAYS, draft.firstAfterDays), dayLabel)}
                  onChange={(v) => patch({ firstAfterDays: Number(v) })}
                />
              </Field>
              <Field label="Second nudge after" htmlFor={`${id}-second`} error={problem}>
                <Select
                  id={`${id}-second`}
                  value={String(draft.secondAfterDays)}
                  disabled={!canEdit}
                  describedBy={problem ? `${id}-second-err` : undefined}
                  options={asOptions(
                    withCurrent(SECOND_NUDGE_DAYS, draft.secondAfterDays),
                    dayLabel,
                  )}
                  onChange={(v) => patch({ secondAfterDays: Number(v) })}
                />
              </Field>
              <Field label="Most emails per person" htmlFor={`${id}-max`}>
                <Select
                  id={`${id}-max`}
                  value={String(draft.maxPerWeek)}
                  disabled={!canEdit}
                  options={asOptions(withCurrent(MAX_PER_WEEK, draft.maxPerWeek), perWeekLabel)}
                  onChange={(v) => patch({ maxPerWeek: Number(v) })}
                />
              </Field>
            </div>
          </section>
          <section
            className={`${CARD} flex flex-col gap-3 bg-bg-fill1 p-5`}
            aria-labelledby={`${id}-on`}
          >
            <h2 id={`${id}-on`} className="font-medium text-[14px] text-text leading-5">
              Always on
            </h2>
            <Checkbox checked disabled>
              Skip anyone who turned off emails
            </Checkbox>
            <Checkbox checked disabled>
              Skip learners who finished the path
            </Checkbox>
            <Checkbox checked disabled>
              Don’t send between 21:00 and 08:00 (learner’s time)
            </Checkbox>
          </section>
          <Note icon={<MailIcon size={16} />}>Uses the “Continue learning” email template.</Note>
        </div>
      ) : null}
    </div>
  );
}
