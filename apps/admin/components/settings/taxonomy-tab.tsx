"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listTaxonomy, renameTaxonomy } from "../../lib/settings/api";
import { plural, taxonomyNameError } from "../../lib/settings/logic";
import { KIND_LABEL, type TaxonomyItem, type TaxonomyKind } from "../../lib/settings/types";
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
import { AddModal, DeleteModal, MergeModal } from "./taxonomy-modals";
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS, INPUT, LINK_MUTED, LINK_RED, PlusIcon } from "./ui";

const BADGE: Record<TaxonomyKind, string> = {
  topic: "bg-success-focus text-success-text",
  tag: "bg-bg-fill2 text-text-secondary",
  level: "bg-primary-focus text-primary-text",
};

const GRID = "md:grid md:grid-cols-[minmax(0,1fr)_96px_140px_90px_190px] md:items-center md:gap-4";

type Dialog =
  | { type: "add" }
  | { type: "merge"; item: TaxonomyItem }
  | { type: "delete"; item: TaxonomyItem };

function KindBadge({ kind }: { kind: TaxonomyKind }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-md px-1.5 font-medium text-[12px] leading-4 ${BADGE[kind]}`}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-soft">
      <div className="h-11 bg-bg-fill1" />
      {["a", "b", "c", "d", "e", "f", "g"].map((k) => (
        <div key={k} className="flex h-16 items-center gap-4 border-border-soft border-t px-4">
          <div className={`${BAR} h-3 max-w-[270px] flex-1`} />
          <div className={`${BAR} h-3 w-14`} />
          <div className={`${BAR} hidden h-3 w-20 md:block`} />
        </div>
      ))}
    </div>
  );
}

function RenameRow({
  item,
  items,
  onCancel,
  onSaved,
}: {
  item: TaxonomyItem;
  items: TaxonomyItem[];
  onCancel: () => void;
  onSaved: (item: TaxonomyItem) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(item.name);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const problem =
    name.trim() === item.name ? null : taxonomyNameError(name, item.kind, items, item.id);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (name.trim() === item.name) return onCancel();
    if (taxonomyNameError(name, item.kind, items, item.id)) return;
    setBusy(true);
    const result = await renameTaxonomy(item.id, name.trim());
    setBusy(false);
    if (result.ok) {
      onSaved({ ...item, ...result.data, name: result.data.name });
      toast({ tone: "success", title: "Renamed", body: `Now “${result.data.name}”.` });
    } else toast({ tone: "error", title: "Couldn’t rename", body: saveFailureText(result) });
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
      className="flex min-w-0 flex-col gap-1"
    >
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          value={name}
          maxLength={80}
          aria-label={`New name for ${item.name}`}
          aria-invalid={problem ? true : undefined}
          onChange={(event) => setName(event.target.value)}
          className={`${INPUT} h-9 max-w-[320px]`}
        />
        <button
          type="submit"
          aria-disabled={busy || undefined}
          className={`${LINK_MUTED} text-text`}
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className={LINK_MUTED}>
          Cancel
        </button>
      </div>
      {problem ? (
        <p role="alert" className="text-[13px] text-error-text leading-5">
          {problem}
        </p>
      ) : null}
    </form>
  );
}

export function TaxonomyTab({ canEdit, actions }: TabProps) {
  const toast = useToast();
  const { state, reload, set } = useLoaded((signal) => listTaxonomy({ signal }));
  const showSkeleton = useSkeletonGate(state.status === "loading");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const items = state.status === "ready" ? state.data : [];

  function done(message: { title: string; body: string }) {
    setDialog(null);
    toast({ tone: "success", ...message });
    reload();
  }

  const addButton =
    canEdit && state.status === "ready" ? (
      <button type="button" onClick={() => setDialog({ type: "add" })} className={BTN_PRIMARY}>
        <PlusIcon size={16} />
        Add
      </button>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      {actions && addButton ? createPortal(addButton, actions) : null}
      <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        Used across paths, the library and search. Topics group content, tags describe it, levels
        set difficulty.
      </p>
      {state.status === "loading" ? (
        <SkeletonFrame label="Loading topics and tags" visible={showSkeleton}>
          <Skeleton />
        </SkeletonFrame>
      ) : state.status === "error" ? (
        <LoadError what="topics and tags" failure={state.failure} onRetry={reload} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border-soft border-dashed px-6 py-16 text-center">
          <h2 className="font-medium text-[16px] text-text leading-6">No topics or tags yet</h2>
          <p className="max-w-[360px] text-[14px] text-text-secondary leading-5">
            Topics, tags and levels you add here show up when you organise resources and paths.
          </p>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setDialog({ type: "add" })}
              className={BTN_SECONDARY}
            >
              <PlusIcon size={16} />
              Add the first one
            </button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-soft">
          <div
            className={`hidden h-11 bg-bg-fill1 px-4 font-medium text-[12px] text-text-secondary leading-4 ${GRID}`}
          >
            <span>Name</span>
            <span>Kind</span>
            <span>Resources</span>
            <span>Paths</span>
            <span className="sr-only">Actions</span>
          </div>
          <ul>
            {items.map((item) => (
              <li
                key={item.id}
                className={`flex min-h-[52px] flex-col gap-2 border-border-soft px-4 py-3 not-first:border-t md:min-h-16 md:py-0 ${GRID}`}
              >
                <div className="flex min-w-0 items-center justify-between gap-3 md:contents">
                  {renaming === item.id ? (
                    <RenameRow
                      item={item}
                      items={items}
                      onCancel={() => setRenaming(null)}
                      onSaved={(next) => {
                        setRenaming(null);
                        set((list) => list.map((i) => (i.id === next.id ? next : i)));
                      }}
                    />
                  ) : (
                    <span className="min-w-0 truncate text-[14px] text-text leading-5">
                      {item.name}
                    </span>
                  )}
                  <span>
                    <KindBadge kind={item.kind} />
                  </span>
                </div>
                <span className="hidden text-[14px] text-text leading-5 md:block">
                  {plural(item.resources, "resource")}
                </span>
                <span className="hidden text-[14px] text-text leading-5 md:block">
                  {item.paths}
                </span>
                <span className="flex items-center gap-4 text-[13px] text-text-secondary md:justify-end">
                  <span className="md:hidden">
                    {plural(item.resources, "resource")} · {plural(item.paths, "path")}
                  </span>
                  {canEdit ? (
                    <span className="ml-auto flex items-center gap-4 md:ml-0">
                      <button
                        type="button"
                        onClick={() => setRenaming(item.id)}
                        aria-label={`Rename ${item.name}`}
                        className={`${LINK_MUTED} text-text`}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog({ type: "merge", item })}
                        aria-label={`Merge ${item.name}`}
                        className={LINK_RED}
                      >
                        Merge
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog({ type: "delete", item })}
                        aria-label={`Delete ${item.name}`}
                        className={`${LINK_MUTED} ${FOCUS}`}
                      >
                        Delete
                      </button>
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dialog?.type === "add" ? (
        <AddModal items={items} onClose={() => setDialog(null)} onDone={done} />
      ) : null}
      {dialog?.type === "merge" ? (
        <MergeModal
          item={dialog.item}
          items={items}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      ) : null}
      {dialog?.type === "delete" ? (
        <DeleteModal
          item={dialog.item}
          items={items}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      ) : null}
    </div>
  );
}
