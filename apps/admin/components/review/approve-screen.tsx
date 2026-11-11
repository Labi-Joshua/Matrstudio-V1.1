"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { QUEUE_HREF } from "../../lib/review/advance";
import { approveSubmission, getSubmission } from "../../lib/review/api";
import {
  type ApproveErrors,
  type ApproveForm,
  checklistSummary,
  initialForm,
  toBody,
  validate,
} from "../../lib/review/approve-form";
import { agoLabel, firstName, shortUrl } from "../../lib/review/format";
import { LEVEL_OPTIONS, PLACEMENTS, TOPIC_OPTIONS, TYPE_OPTIONS } from "../../lib/review/options";
import type { SubmissionDetail } from "../../lib/review/types";
import { BackLink, DetailGate, ReviewRoot } from "./detail-parts";
import { Field, Radio, Select, Switch, TextArea, TextInput } from "./fields";
import { useLoad } from "./hooks";
import { Badge, Button, Card, PageTitle, Row } from "./ui";
import { useDecision } from "./use-decision";

const detailHref = (id: string) => `/review/submission?id=${encodeURIComponent(id)}`;

export function ApproveScreen() {
  const id = useSearchParams().get("id") ?? "";
  const { state, reload } = useLoad(`approve:${id}`, (signal) => getSubmission(id, signal));
  return (
    <ReviewRoot>
      <DetailGate
        state={
          id === ""
            ? {
                status: "error",
                failure: { ok: false, code: "not_found", message: "", status: 404 },
              }
            : state
        }
        reload={reload}
        backHref={QUEUE_HREF}
        backLabel="Review queues"
        what="submission"
      >
        {(s) => <Form submission={s} />}
      </DetailGate>
    </ReviewRoot>
  );
}

function Form({ submission: s }: { submission: SubmissionDetail }) {
  const router = useRouter();
  const decision = useDecision(s.id);
  const [form, setForm] = useState<ApproveForm>(() => initialForm(s));
  const [errors, setErrors] = useState<ApproveErrors>({});
  const name = firstName(s.submitter.name);
  const set = <K extends keyof ApproveForm>(key: K, value: ApproveForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function publish() {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(`rv-a-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    await decision.run(() => approveSubmission(s.id, toBody(form)), {
      title: "Approved and published",
      body: form.credit ? `${name} gets credit.` : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={detailHref(s.id)} label="Submission" />
      <PageTitle
        title="Approve and publish"
        badge={<Badge>From a submission</Badge>}
        subtitle={`Fill in the record. ${name} gets credit once it’s live.`}
        actions={
          <>
            <Button onClick={() => router.push(detailHref(s.id))} disabled={decision.busy}>
              Back
            </Button>
            <Button variant="primary" onClick={publish} disabled={decision.busy}>
              {decision.busy ? "Publishing…" : "Publish"}
            </Button>
          </>
        }
      />
      {decision.error ? (
        <p
          role="alert"
          className="rounded-xl border border-error-border bg-error-accent px-4 py-3 text-[13px] text-error-text"
        >
          {decision.error}
        </p>
      ) : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <Card title="Record">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="rv-a-title" error={errors.title}>
                <TextInput
                  id="rv-a-title"
                  value={form.title}
                  maxLength={160}
                  aria-invalid={!!errors.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </Field>
              <Field label="Creator" htmlFor="rv-a-creator" error={errors.creator}>
                <TextInput
                  id="rv-a-creator"
                  value={form.creator}
                  maxLength={120}
                  aria-invalid={!!errors.creator}
                  onChange={(e) => set("creator", e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Type" htmlFor="rv-a-type" error={errors.type}>
                <Select
                  id="rv-a-type"
                  value={form.type}
                  options={TYPE_OPTIONS}
                  onChange={(e) => set("type", e.target.value)}
                />
              </Field>
              <Field label="Topic" htmlFor="rv-a-topic" error={errors.topic}>
                <Select
                  id="rv-a-topic"
                  value={form.topic}
                  placeholder="Pick a topic"
                  options={TOPIC_OPTIONS}
                  onChange={(e) => set("topic", e.target.value)}
                />
              </Field>
              <Field label="Level" htmlFor="rv-a-level" error={errors.level}>
                <Select
                  id="rv-a-level"
                  value={form.level}
                  placeholder="Pick a level"
                  options={LEVEL_OPTIONS}
                  onChange={(e) => set("level", e.target.value)}
                />
              </Field>
            </div>
          </Card>
          <Card title="What learners see">
            <Field
              label="Intro"
              htmlFor="rv-a-intro"
              error={errors.intro}
              hint={`${form.intro.length} of 400`}
            >
              <TextArea
                id="rv-a-intro"
                value={form.intro}
                rows={5}
                aria-invalid={!!errors.intro}
                onChange={(e) => set("intro", e.target.value)}
              />
            </Field>
          </Card>
          <Card title="Where it goes">
            <fieldset className="m-0 border-0 p-0">
              <legend className="sr-only">Where it goes</legend>
              {PLACEMENTS.map((p) => (
                <Radio
                  key={p.value}
                  name="rv-placement"
                  value={p.value}
                  checked={form.placement === p.value}
                  onChange={() => set("placement", p.value)}
                  label={p.label}
                  hint={p.hint}
                />
              ))}
            </fieldset>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card title="Credit">
            <Switch
              checked={form.credit}
              onChange={(on) => set("credit", on)}
              label={`Show “Suggested by ${s.submitter.name}”`}
            />
            <p className="mt-2 text-[12px] text-text-tertiary">
              {name} is notified in the app and by email when it’s published.
            </p>
          </Card>
          <Card title="From the submission">
            <dl className="m-0">
              <Row label="Link">{shortUrl(s.url, 22)}</Row>
              <Row label="Submitted">{agoLabel(s.ageDays)}</Row>
              <Row label="Checklist">{checklistSummary(s)}</Row>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
