"use client";

import { useState } from "react";
import { durationLabel, metaLine, parseMinutes } from "../../lib/content/format";
import {
  LEVEL_OPTIONS,
  LICENSE_OPTIONS,
  labelOf,
  TOPIC_OPTIONS,
  TYPE_OPTIONS,
} from "../../lib/content/options";
import type { Level, ResourceType } from "../../lib/content/types";
import { Badge, Field, Panel, Select, TextArea, TextInput, Thumb, XIcon } from "./ui";

export type Draft = {
  url: string;
  title: string;
  creator: string;
  source: string;
  type: ResourceType;
  topic: string;
  level: Level;
  license: string;
  minutes: string;
  intro: string;
  learningGoal: string;
  tags: string[];
  thumbnail: string | null;
};

export type DraftErrors = Partial<Record<"title" | "topic" | "license" | "intro", string>>;

type Change = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

const INTRO_MAX = 400;

export function RecordFields({
  draft,
  errors,
  onChange,
}: {
  draft: Draft;
  errors: DraftErrors;
  onChange: Change;
}) {
  const withCurrent = (list: string[], current: string) =>
    current && !list.includes(current) ? [current, ...list] : list;
  return (
    <Panel title="Record">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title" error={errors.title}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={draft.title}
              maxLength={160}
              onChange={(e) => onChange("title", e.target.value)}
            />
          )}
        </Field>
        <Field label="Creator">
          {({ id }) => (
            <TextInput
              id={id}
              value={draft.creator}
              maxLength={120}
              onChange={(e) => onChange("creator", e.target.value)}
            />
          )}
        </Field>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field label="Type">
          {({ id }) => (
            <Select
              id={id}
              value={draft.type}
              onChange={(e) => onChange("type", e.target.value as ResourceType)}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Topic" error={errors.topic}>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={draft.topic}
              onChange={(e) => onChange("topic", e.target.value)}
            >
              <option value="">Choose a topic</option>
              {withCurrent(TOPIC_OPTIONS, draft.topic).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Level">
          {({ id }) => (
            <Select
              id={id}
              value={draft.level}
              onChange={(e) => onChange("level", e.target.value as Level)}
            >
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="License" error={errors.license}>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={draft.license}
              onChange={(e) => onChange("license", e.target.value)}
            >
              <option value="">Choose a licence</option>
              {withCurrent(LICENSE_OPTIONS, draft.license).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Length (minutes)">
          {({ id }) => (
            <TextInput
              id={id}
              inputMode="numeric"
              value={draft.minutes}
              onChange={(e) => onChange("minutes", e.target.value.replace(/[^0-9]/g, ""))}
            />
          )}
        </Field>
      </div>
      <div className="mt-4">
        <TagsField tags={draft.tags} onChange={(tags) => onChange("tags", tags)} />
      </div>
    </Panel>
  );
}

function TagsField({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const tag = raw.trim().replace(/,$/, "").trim();
    if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase()) && tags.length < 12)
      onChange([...tags, tag]);
    setText("");
  };
  return (
    <Field label="Tags" hint="Press Enter or comma to add one. Up to 12.">
      {({ id, describedBy }) => (
        <div className="flex flex-col gap-2">
          <TextInput
            id={id}
            aria-describedby={describedBy}
            value={text}
            maxLength={40}
            onChange={(e) => {
              if (e.target.value.endsWith(",")) add(e.target.value);
              else setText(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(text);
              } else if (e.key === "Backspace" && text === "" && tags.length > 0) {
                onChange(tags.slice(0, -1));
              }
            }}
            onBlur={() => text.trim() && add(text)}
          />
          {tags.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li
                  key={tag}
                  className="flex h-7 items-center gap-1 rounded-full bg-bg-fill2 pr-1 pl-3 text-[13px]"
                >
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => onChange(tags.filter((t) => t !== tag))}
                    className="flex size-5 items-center justify-center rounded-full text-text-tertiary hover:text-text focus-visible:outline-2 focus-visible:outline-primary-border"
                  >
                    <XIcon className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </Field>
  );
}

export function LearnerFields({
  draft,
  errors,
  onChange,
}: {
  draft: Draft;
  errors: DraftErrors;
  onChange: Change;
}) {
  return (
    <Panel title="What learners see">
      <div className="flex flex-col gap-4">
        <Field
          label="Intro"
          error={errors.intro}
          hint={`${draft.intro.length} of ${INTRO_MAX} characters`}
        >
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              rows={4}
              maxLength={INTRO_MAX}
              value={draft.intro}
              onChange={(e) => onChange("intro", e.target.value)}
            />
          )}
        </Field>
        <Field label="Learning goal">
          {({ id }) => (
            <TextInput
              id={id}
              maxLength={200}
              value={draft.learningGoal}
              onChange={(e) => onChange("learningGoal", e.target.value)}
            />
          )}
        </Field>
      </div>
    </Panel>
  );
}

export function LearnerPreview({ draft }: { draft: Draft }) {
  const minutes = parseMinutes(draft.minutes);
  return (
    <Panel title="Learner preview" className="lg:sticky lg:top-6">
      <Thumb src={draft.thumbnail} className="aspect-video w-full" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{labelOf(TYPE_OPTIONS, draft.type)}</Badge>
        {minutes ? <Badge>{durationLabel(minutes, draft.type)}</Badge> : null}
        <Badge>{labelOf(LEVEL_OPTIONS, draft.level)}</Badge>
      </div>
      <p className="mt-3 font-medium text-[14px] leading-5">{draft.title || "Untitled resource"}</p>
      <p className="mt-1 text-[13px] text-text-secondary leading-5">
        {draft.intro || "The intro you write shows here."}
      </p>
      <p className="mt-3 text-[12px] text-text-tertiary leading-4">
        {metaLine([draft.source, draft.creator])}
      </p>
    </Panel>
  );
}
