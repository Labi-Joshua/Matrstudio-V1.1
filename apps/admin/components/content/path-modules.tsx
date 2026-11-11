"use client";

import { useState } from "react";
import { durationLabel, metaLine } from "../../lib/content/format";
import { findLesson, lessonNumber } from "../../lib/content/reorder";
import type { Lesson, Module } from "../../lib/content/types";
import {
  Badge,
  Button,
  ChevronDownIcon,
  ChevronUpIcon,
  FOCUS,
  GripIcon,
  PlusIcon,
  TextInput,
  TrashIcon,
  TYPE_LABEL,
  textActionClass,
} from "./ui";

export type ModuleActions = {
  onStepLesson: (lessonId: string, dir: -1 | 1) => void;
  onMoveLesson: (lessonId: string, moduleIndex: number, index: number) => void;
  onEditIntro: (lesson: Lesson) => void;
  onRemoveLesson: (lesson: Lesson) => void;
  onAddLessons: (moduleId: string) => void;
  onRename: (moduleId: string, title: string) => void;
  onStepModule: (moduleId: string, dir: -1 | 1) => void;
  onRemoveModule: (moduleId: string) => void;
};

const iconButton = `flex size-8 items-center justify-center rounded-lg text-text-tertiary hover:bg-bg-fill2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent ${FOCUS}`;

export function ModuleList({
  modules,
  editable,
  actions,
}: {
  modules: Module[];
  editable: boolean;
  actions: ModuleActions;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      {modules.map((module, mi) => (
        <ModuleCard
          key={module.id}
          module={module}
          index={mi}
          modules={modules}
          editable={editable}
          actions={actions}
          dragId={dragId}
          setDragId={setDragId}
        />
      ))}
    </div>
  );
}

function ModuleCard({
  module,
  index,
  modules,
  editable,
  actions,
  dragId,
  setDragId,
}: {
  module: Module;
  index: number;
  modules: Module[];
  editable: boolean;
  actions: ModuleActions;
  dragId: string | null;
  setDragId: (id: string | null) => void;
}) {
  const drop = (at: number) => {
    if (!dragId) return;
    const from = findLesson(modules, dragId);
    const adjust = from && from.moduleIndex === index && from.index < at ? at - 1 : at;
    actions.onMoveLesson(dragId, index, adjust);
    setDragId(null);
  };
  return (
    <section
      aria-label={`Module ${index + 1}`}
      className="rounded-2xl border border-border-soft bg-bg-base p-4 sm:p-5"
      onDragOver={(e) => dragId && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        drop(module.lessons.length);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[14px] text-text-secondary">Module {index + 1} ·</span>
          <TextInput
            aria-label={`Module ${index + 1} title`}
            value={module.title}
            maxLength={80}
            placeholder="Module title"
            disabled={!editable}
            onChange={(e) => actions.onRename(module.id, e.target.value)}
            className="h-9 border-transparent bg-transparent px-2 font-medium hover:border-border"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={iconButton}
            aria-label={`Move module ${index + 1} up`}
            disabled={!editable || index === 0}
            onClick={() => actions.onStepModule(module.id, -1)}
          >
            <ChevronUpIcon />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={`Move module ${index + 1} down`}
            disabled={!editable || index === modules.length - 1}
            onClick={() => actions.onStepModule(module.id, 1)}
          >
            <ChevronDownIcon />
          </button>
          {editable ? (
            <button
              type="button"
              className={`${textActionClass} px-2 text-primary-text`}
              onClick={() => actions.onAddLessons(module.id)}
            >
              Add lessons
            </button>
          ) : null}
        </div>
      </div>

      {module.lessons.length === 0 ? (
        <div className="mt-3 flex flex-col items-start gap-2 rounded-xl border border-border border-dashed p-4 text-[14px] text-text-secondary">
          <p>No lessons yet.</p>
          {editable ? (
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => actions.onAddLessons(module.id)}>
                <PlusIcon />
                Add lessons
              </Button>
              <button
                type="button"
                className={`${textActionClass} text-error-text`}
                onClick={() => actions.onRemoveModule(module.id)}
              >
                Remove module
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {module.lessons.map((lesson, li) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              position={lessonNumber(modules, lesson.id)}
              first={index === 0 && li === 0}
              last={index === modules.length - 1 && li === module.lessons.length - 1}
              editable={editable}
              actions={actions}
              dragging={dragId === lesson.id}
              onDragStart={() => setDragId(lesson.id)}
              onDragEnd={() => setDragId(null)}
              onDropBefore={() => drop(li)}
              canDrop={dragId !== null}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function LessonRow({
  lesson,
  position,
  first,
  last,
  editable,
  actions,
  dragging,
  canDrop,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  lesson: Lesson;
  position: number;
  first: boolean;
  last: boolean;
  editable: boolean;
  actions: ModuleActions;
  dragging: boolean;
  canDrop: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropBefore: () => void;
}) {
  const ready = lesson.intro.trim() !== "";
  return (
    <li
      draggable={editable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", lesson.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => canDrop && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropBefore();
      }}
      className={`flex flex-wrap items-center gap-3 rounded-xl bg-bg-fill1 px-3 py-3 ${dragging ? "opacity-40" : ""}`}
    >
      {editable ? (
        <span aria-hidden="true" className="cursor-grab text-text-tertiary active:cursor-grabbing">
          <GripIcon />
        </span>
      ) : null}
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-bg-base text-[12px] text-text-secondary">
        {position}
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-medium text-[14px] leading-5">{lesson.title}</p>
        <p className="truncate text-[12px] text-text-tertiary leading-4">
          {metaLine([
            TYPE_LABEL[lesson.type],
            lesson.source,
            durationLabel(lesson.durationMin, lesson.type),
          ])}
        </p>
      </div>
      <Badge tone={ready ? "success" : "warning"}>{ready ? "Intro ready" : "Needs intro"}</Badge>
      <button
        type="button"
        className={`${textActionClass} px-1`}
        aria-label={`Edit intro for ${lesson.title}`}
        onClick={() => actions.onEditIntro(lesson)}
      >
        Edit intro
      </button>
      {editable ? (
        <div className="flex items-center">
          <button
            type="button"
            className={iconButton}
            aria-label={`Move ${lesson.title} up`}
            disabled={first}
            onClick={() => actions.onStepLesson(lesson.id, -1)}
          >
            <ChevronUpIcon />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={`Move ${lesson.title} down`}
            disabled={last}
            onClick={() => actions.onStepLesson(lesson.id, 1)}
          >
            <ChevronDownIcon />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={`Remove ${lesson.title} from the path`}
            onClick={() => actions.onRemoveLesson(lesson)}
          >
            <TrashIcon />
          </button>
        </div>
      ) : null}
    </li>
  );
}
