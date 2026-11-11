"use client";

import { useId, useMemo, useState } from "react";
import type { ApiResult } from "../../lib/api";
import { listPublishedPaths, listPublishedResources } from "../../lib/settings/api";
import type { CuratedPath, CuratedResource, HomeCuration } from "../../lib/settings/types";
import { Modal } from "./overlay";
import { BAR, LoadError, useLoaded, useSkeletonGate } from "./state";
import { Button, INPUT, PlusIcon, UsersIcon } from "./ui";

type Entry = { id: string; title: string; meta: string };

function useEntries(kind: "path" | "resource") {
  const { state, reload } = useLoaded<Entry[]>(async (signal) => {
    if (kind === "path") {
      const r: ApiResult<CuratedPath[]> = await listPublishedPaths({ signal });
      return r.ok
        ? {
            ok: true,
            data: r.data.map((p) => ({ id: p.id, title: p.title, meta: p.level })),
          }
        : r;
    }
    const r: ApiResult<CuratedResource[]> = await listPublishedResources({ signal });
    return r.ok
      ? {
          ok: true,
          data: r.data.map((p) => ({
            id: p.id,
            title: p.title,
            meta: [p.kind, p.minutes ? `${p.minutes} min` : ""].filter(Boolean).join(" · "),
          })),
        }
      : r;
  });
  return { state, reload };
}

/** Pick published paths or resources to add to Home. Already-added ones are not offered. */
export function PickerModal({
  kind,
  taken,
  onClose,
  onAdd,
}: {
  kind: "path" | "resource";
  taken: string[];
  onClose: () => void;
  onAdd: (picked: Entry[]) => void;
}) {
  const id = useId();
  const { state, reload } = useEntries(kind);
  const showSkeleton = useSkeletonGate(state.status === "loading");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const available = useMemo(() => {
    if (state.status !== "ready") return [];
    const q = query.trim().toLowerCase();
    return state.data.filter(
      (e) => !taken.includes(e.id) && (!q || e.title.toLowerCase().includes(q)),
    );
  }, [state, taken, query]);
  const noun = kind === "path" ? "path" : "resource";

  return (
    <Modal
      title={kind === "path" ? "Add featured paths" : "Add library picks"}
      subtitle={`Only published ${noun}s can go on Home.`}
      icon={<PlusIcon size={24} />}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={picked.length === 0}
            onClick={() => {
              if (state.status !== "ready") return;
              onAdd(picked.flatMap((p) => state.data.filter((e) => e.id === p)));
            }}
          >
            {picked.length > 0 ? `Add ${picked.length}` : "Add"}
          </Button>
        </>
      }
    >
      <label htmlFor={`${id}-q`} className="sr-only">
        Search {noun}s
      </label>
      <input
        id={`${id}-q`}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${noun}s`}
        className={INPUT}
      />
      {state.status === "loading" ? (
        <div role="status" aria-busy="true">
          <p className="sr-only">Loading {noun}s</p>
          {showSkeleton ? (
            <div aria-hidden="true" className="flex flex-col gap-2">
              {["a", "b", "c", "d"].map((k) => (
                <div key={k} className={`${BAR} h-12`} />
              ))}
            </div>
          ) : null}
        </div>
      ) : state.status === "error" ? (
        <LoadError what={`${noun}s`} failure={state.failure} onRetry={reload} />
      ) : available.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-text-secondary leading-5">
          {query
            ? `No ${noun}s match “${query.trim()}”.`
            : `Every published ${noun} is already on Home, or none are published yet.`}
        </p>
      ) : (
        <ul className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
          {available.map((e) => (
            <li key={e.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-bg-fill1">
                <input
                  type="checkbox"
                  checked={picked.includes(e.id)}
                  onChange={(event) =>
                    setPicked((p) =>
                      event.target.checked ? [...p, e.id] : p.filter((x) => x !== e.id),
                    )
                  }
                  className="size-4 accent-primary"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[14px] text-text leading-5">{e.title}</span>
                  {e.meta ? (
                    <span className="truncate text-[12px] text-text-tertiary leading-4">
                      {e.meta}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** What Home will show, in order, from the unsaved draft. Nothing is sent. */
export function PreviewModal({ draft, onClose }: { draft: HomeCuration; onClose: () => void }) {
  return (
    <Modal
      title="Preview Home"
      subtitle="Your unsaved order. The learner app shows these in this order."
      icon={<UsersIcon size={24} />}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-[14px] text-text leading-5">Featured paths</h3>
        {draft.featuredPaths.length === 0 ? (
          <p className="text-[14px] text-text-secondary">None picked.</p>
        ) : (
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-[14px] text-text leading-5">
            {draft.featuredPaths.map((p) => (
              <li key={p.id}>{p.title}</li>
            ))}
          </ol>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-[14px] text-text leading-5">Library picks</h3>
        {draft.libraryPicks.length === 0 ? (
          <p className="text-[14px] text-text-secondary">None picked.</p>
        ) : (
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-[14px] text-text leading-5">
            {draft.libraryPicks.map((p) => (
              <li key={p.id}>{p.title}</li>
            ))}
          </ol>
        )}
      </section>
    </Modal>
  );
}
