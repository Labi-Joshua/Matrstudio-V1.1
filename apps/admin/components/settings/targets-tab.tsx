"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { getQueueTargets, putQueueTargets } from "../../lib/settings/api";
import {
  AUTO_RESOLVE_DAYS,
  dayLabel,
  FIRST_REPLY_DAYS,
  isDirty,
  LINK_REPORT_DAYS,
  REVIEW_DAYS,
  targetsError,
  toggleDay,
  WEEKDAY_LABEL,
  withCurrent,
} from "../../lib/settings/logic";
import { type QueueTargets, WEEKDAYS } from "../../lib/settings/types";
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
import { Button, ClockIcon, DayChip, Field, Note, PANEL, Select } from "./ui";

const days = (values: number[], current: number) =>
  withCurrent(values, current).map((n) => ({ value: String(n), label: dayLabel(n) }));

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className={`${BAR} h-36 rounded-2xl`} />
      <div className={`${BAR} h-48 rounded-2xl`} />
    </div>
  );
}

export function TargetsTab({ canEdit, actions, onDirty }: TabProps) {
  const toast = useToast();
  const id = useId();
  const { state, reload, set } = useLoaded((signal) => getQueueTargets({ signal }));
  const showSkeleton = useSkeletonGate(state.status === "loading");
  const [draft, setDraft] = useState<QueueTargets | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = state.status === "ready" ? state.data : null;
  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);
  const dirty = saved !== null && draft !== null && isDirty(saved, draft);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  const problem = draft ? targetsError(draft.workingDays) : null;

  async function save() {
    if (!draft || saving || !dirty) return;
    if (problem) {
      toast({ tone: "error", title: "Couldn’t save", body: problem });
      return;
    }
    setSaving(true);
    const result = await putQueueTargets(draft);
    setSaving(false);
    if (result.ok) {
      set(() => result.data);
      setDraft(result.data);
      toast({
        tone: "success",
        title: "Settings saved",
        body: "New targets apply to items already in the queues.",
      });
    } else toast({ tone: "error", title: "Couldn’t save", body: saveFailureText(result) });
  }

  const header =
    canEdit && state.status === "ready" ? (
      <Button onClick={save} busy={saving} disabled={!dirty}>
        Save changes
      </Button>
    ) : null;
  const patch = (p: Partial<QueueTargets>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <div>
      {actions && header ? createPortal(header, actions) : null}
      {state.status === "loading" ? (
        <SkeletonFrame label="Loading queue targets" visible={showSkeleton}>
          <Skeleton />
        </SkeletonFrame>
      ) : state.status === "error" ? (
        <LoadError what="queue targets" failure={state.failure} onRetry={reload} />
      ) : draft ? (
        <div className="flex flex-col gap-4">
          <section className={`${PANEL} flex flex-col gap-4 p-5`} aria-labelledby={`${id}-rq`}>
            <h2 id={`${id}-rq`} className="font-medium text-[14px] text-text leading-5">
              Review queues
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Review submissions within" htmlFor={`${id}-sub`}>
                <Select
                  id={`${id}-sub`}
                  value={String(draft.submissionDays)}
                  disabled={!canEdit}
                  options={days(REVIEW_DAYS, draft.submissionDays)}
                  onChange={(v) => patch({ submissionDays: Number(v) })}
                />
              </Field>
              <Field label="Check link reports within" htmlFor={`${id}-link`}>
                <Select
                  id={`${id}-link`}
                  value={String(draft.linkReportDays)}
                  disabled={!canEdit}
                  options={days(LINK_REPORT_DAYS, draft.linkReportDays)}
                  onChange={(v) => patch({ linkReportDays: Number(v) })}
                />
              </Field>
            </div>
          </section>
          <section className={`${PANEL} flex flex-col gap-4 p-5`} aria-labelledby={`${id}-si`}>
            <h2 id={`${id}-si`} className="font-medium text-[14px] text-text leading-5">
              Support inbox
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="First reply within" htmlFor={`${id}-reply`}>
                <Select
                  id={`${id}-reply`}
                  value={String(draft.firstReplyDays)}
                  disabled={!canEdit}
                  options={withCurrent(FIRST_REPLY_DAYS, draft.firstReplyDays).map((n) => ({
                    value: String(n),
                    label: `${n} working ${n === 1 ? "day" : "days"}`,
                  }))}
                  onChange={(v) => patch({ firstReplyDays: Number(v) })}
                />
              </Field>
              <Field label="Auto-resolve after no reply" htmlFor={`${id}-auto`}>
                <Select
                  id={`${id}-auto`}
                  value={String(draft.autoResolveDays)}
                  disabled={!canEdit}
                  options={days(AUTO_RESOLVE_DAYS, draft.autoResolveDays)}
                  onChange={(v) => patch({ autoResolveDays: Number(v) })}
                />
              </Field>
            </div>
            <fieldset className="flex flex-wrap items-center gap-2">
              <legend className="sr-only">Working days</legend>
              <span aria-hidden="true" className="mr-1 text-[12px] text-text-tertiary">
                Working days
              </span>
              {WEEKDAYS.map((d) => (
                <DayChip
                  key={d}
                  on={draft.workingDays.includes(d)}
                  disabled={!canEdit}
                  onClick={() => patch({ workingDays: toggleDay(draft.workingDays, d) })}
                >
                  {WEEKDAY_LABEL[d]}
                </DayChip>
              ))}
            </fieldset>
            {problem ? (
              <p role="alert" className="text-[13px] text-error-text leading-5">
                {problem}
              </p>
            ) : null}
          </section>
          <Note icon={<ClockIcon size={16} />}>
            Items past their target show as overdue and move to the top of the list.
          </Note>
        </div>
      ) : null}
    </div>
  );
}
