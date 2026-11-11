"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { getHomeCuration, putHomeCuration } from "../../lib/settings/api";
import { isDirty, plural } from "../../lib/settings/logic";
import {
  type CuratedPath,
  type CuratedResource,
  type HomeCuration,
  RANK_OPTIONS,
  WINDOW_OPTIONS,
} from "../../lib/settings/types";
import { CurationList } from "./curation-list";
import { PickerModal, PreviewModal } from "./curation-modals";
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
import {
  BTN_SECONDARY,
  Button,
  CARD,
  Checkbox,
  Field,
  LINK_ORANGE,
  Note,
  Select,
  UsersIcon,
} from "./ui";

const pathMeta = (p: CuratedPath) =>
  [p.level, p.learners === null ? "" : plural(p.learners, "learner")].filter(Boolean).join(" · ");
const resourceMeta = (r: CuratedResource) =>
  [r.kind, r.minutes ? `${r.minutes} min` : ""].filter(Boolean).join(" · ");

function Skeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-4">
        {["a", "b"].map((k) => (
          <div key={k} className={`${CARD} flex flex-col gap-3 p-5`}>
            <div className={`${BAR} h-4 w-28`} />
            {["1", "2", "3"].map((r) => (
              <div key={r} className={`${BAR} h-14`} />
            ))}
          </div>
        ))}
      </div>
      <div className={`${CARD} flex flex-col gap-3 p-5`}>
        <div className={`${BAR} h-4 w-28`} />
        <div className={`${BAR} h-10`} />
        <div className={`${BAR} h-10`} />
      </div>
    </div>
  );
}

export function HomeTab({ canEdit, actions, onDirty }: TabProps) {
  const toast = useToast();
  const id = useId();
  const { state, reload, set } = useLoaded((signal) => getHomeCuration({ signal }));
  const showSkeleton = useSkeletonGate(state.status === "loading");
  const [draft, setDraft] = useState<HomeCuration | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<"path" | "resource" | "preview" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const saved = state.status === "ready" ? state.data : null;

  // The draft starts as a copy of what the server has; a save or a reload replaces both.
  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);
  const dirty = saved !== null && draft !== null && isDirty(saved, draft);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);

  async function save() {
    if (!draft || saving || !dirty) return;
    setSaving(true);
    const result = await putHomeCuration({
      featuredPaths: draft.featuredPaths.map((p) => p.id),
      libraryPicks: draft.libraryPicks.map((r) => r.id),
      popularRules: draft.popular,
    });
    setSaving(false);
    if (result.ok) {
      set(() => result.data);
      setDraft(result.data);
      toast({ tone: "success", title: "Home curation saved", body: "Every change is logged." });
    } else toast({ tone: "error", title: "Couldn’t save", body: saveFailureText(result) });
  }

  const header =
    state.status === "ready" && draft ? (
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setDialog("preview")} className={BTN_SECONDARY}>
          Preview Home
        </button>
        {canEdit ? (
          <Button onClick={save} busy={saving} disabled={!dirty}>
            Save changes
          </Button>
        ) : null}
      </div>
    ) : null;

  const move = (patch: Partial<HomeCuration>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const reorder = <T extends { id: string }>(list: T[], order: string[]) =>
    order.flatMap((o) => list.filter((x) => x.id === o));

  return (
    <div>
      {actions && header ? createPortal(header, actions) : null}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {state.status === "loading" ? (
        <SkeletonFrame label="Loading Home curation" visible={showSkeleton}>
          <Skeleton />
        </SkeletonFrame>
      ) : state.status === "error" ? (
        <LoadError what="Home curation" failure={state.failure} onRetry={reload} />
      ) : draft ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-4">
            <section className={`${CARD} flex flex-col gap-4 p-5`} aria-labelledby={`${id}-fp`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id={`${id}-fp`} className="font-medium text-[14px] text-text leading-5">
                    Featured paths
                  </h2>
                  <p className="text-[12px] text-text-tertiary leading-4">
                    Shown at the top of Home, in this order.{canEdit ? " Drag to reorder." : ""}
                  </p>
                </div>
                {canEdit ? (
                  <button type="button" onClick={() => setDialog("path")} className={LINK_ORANGE}>
                    Add path
                  </button>
                ) : null}
              </div>
              <CurationList
                label="Featured paths"
                canEdit={canEdit}
                emptyText="No featured paths. Home falls back to the popular paths."
                rows={draft.featuredPaths.map((p) => ({
                  id: p.id,
                  title: p.title,
                  meta: pathMeta(p),
                }))}
                onChange={(order) => move({ featuredPaths: reorder(draft.featuredPaths, order) })}
                announce={setAnnouncement}
              />
            </section>
            <section className={`${CARD} flex flex-col gap-4 p-5`} aria-labelledby={`${id}-lp`}>
              <div className="flex items-start justify-between gap-4">
                <h2 id={`${id}-lp`} className="font-medium text-[14px] text-text leading-5">
                  Library picks
                </h2>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => setDialog("resource")}
                    className={LINK_ORANGE}
                  >
                    Add resource
                  </button>
                ) : null}
              </div>
              <CurationList
                label="Library picks"
                canEdit={canEdit}
                emptyText="No library picks yet."
                rows={draft.libraryPicks.map((r) => ({
                  id: r.id,
                  title: r.title,
                  meta: resourceMeta(r),
                }))}
                onChange={(order) => move({ libraryPicks: reorder(draft.libraryPicks, order) })}
                announce={setAnnouncement}
              />
            </section>
          </div>
          <div className="flex min-w-0 flex-col gap-4 xl:self-start">
            <section className={`${CARD} flex flex-col gap-4 p-5`} aria-labelledby={`${id}-pr`}>
              <h2 id={`${id}-pr`} className="font-medium text-[14px] text-text leading-5">
                “Popular” rules
              </h2>
              <Field label="Rank by" htmlFor={`${id}-rank`}>
                <Select
                  id={`${id}-rank`}
                  value={draft.popular.rankBy}
                  disabled={!canEdit}
                  options={RANK_OPTIONS}
                  onChange={(rankBy) => move({ popular: { ...draft.popular, rankBy } })}
                />
              </Field>
              <Field label="Time window" htmlFor={`${id}-window`}>
                <Select
                  id={`${id}-window`}
                  value={draft.popular.window}
                  disabled={!canEdit}
                  options={WINDOW_OPTIONS}
                  onChange={(window) => move({ popular: { ...draft.popular, window } })}
                />
              </Field>
              <Checkbox
                checked={draft.popular.hideReported}
                disabled={!canEdit}
                onChange={(hideReported) => move({ popular: { ...draft.popular, hideReported } })}
              >
                Hide items with open link reports
              </Checkbox>
              <Checkbox
                checked={draft.popular.minLearners !== null}
                disabled={!canEdit}
                onChange={(on) =>
                  move({ popular: { ...draft.popular, minLearners: on ? 20 : null } })
                }
              >
                At least 20 learners
              </Checkbox>
            </section>
            <Note icon={<UsersIcon size={16} />}>
              Curators can change this tab. Everything else in Settings is Admin only.
            </Note>
          </div>
        </div>
      ) : null}
      {dialog === "path" && draft ? (
        <PickerModal
          kind="path"
          taken={draft.featuredPaths.map((p) => p.id)}
          onClose={() => setDialog(null)}
          onAdd={(picked) => {
            move({
              featuredPaths: [
                ...draft.featuredPaths,
                ...picked.map((p) => ({ id: p.id, title: p.title, level: p.meta, learners: null })),
              ],
            });
            setAnnouncement(`${plural(picked.length, "path")} added.`);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === "resource" && draft ? (
        <PickerModal
          kind="resource"
          taken={draft.libraryPicks.map((r) => r.id)}
          onClose={() => setDialog(null)}
          onAdd={(picked) => {
            move({
              libraryPicks: [
                ...draft.libraryPicks,
                ...picked.map((r) => ({ id: r.id, title: r.title, kind: r.meta, minutes: null })),
              ],
            });
            setAnnouncement(`${plural(picked.length, "resource")} added.`);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === "preview" && draft ? (
        <PreviewModal draft={draft} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}
