"use client";

import { useEffect, useId, useState } from "react";
import type { ApiFailure } from "../../lib/api";
import {
  createTaxonomy,
  deleteTaxonomy,
  mergeTaxonomy,
  taxonomyUsage,
} from "../../lib/settings/api";
import { optionLabel, plural, taxonomyNameError } from "../../lib/settings/logic";
import {
  KIND_LABEL,
  TAXONOMY_KINDS,
  type TaxonomyItem,
  type TaxonomyKind,
  type TaxonomyUsage,
} from "../../lib/settings/types";
import { Modal } from "./overlay";
import { saveFailureText } from "./state";
import {
  Button,
  CopyIcon,
  Field,
  INPUT,
  Note,
  type Option,
  PlusIcon,
  Select,
  TrashIcon,
} from "./ui";

type Common = {
  items: TaxonomyItem[];
  onClose: () => void;
  /** Called after the change went through; the list reloads. */
  onDone: (message: { title: string; body: string }) => void;
};

/** Usage counts of one entry, loaded when its dialog opens. */
function useUsage(id: string) {
  const [usage, setUsage] = useState<TaxonomyUsage | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: nonce re-runs the load on retry
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    taxonomyUsage(id, { signal: controller.signal }).then((r) => {
      if (controller.signal.aborted) return;
      if (r.ok) setUsage(r.data);
      else setFailed(true);
    });
    return () => controller.abort();
  }, [id, nonce]);
  return { usage, failed, retry: () => setNonce((n) => n + 1) };
}

const others = (items: TaxonomyItem[], id: string): Option[] =>
  items.filter((i) => i.id !== id).map((i) => ({ value: i.id, label: optionLabel(i) }));

function ErrorLine({ failure }: { failure: ApiFailure | null }) {
  return failure ? (
    <p role="alert" className="text-[13px] text-error-text leading-5">
      {saveFailureText(failure)}
    </p>
  ) : null;
}

function UsageRows({
  usage,
  failed,
  retry,
  rows,
}: {
  usage: TaxonomyUsage | null;
  failed: boolean;
  retry: () => void;
  rows: [string, string][];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-bg-fill1 p-4 text-[14px] leading-5">
      {failed ? (
        <p role="alert" className="text-error-text">
          We couldn’t count what uses this.{" "}
          <button type="button" onClick={retry} className="font-medium underline">
            Try again
          </button>
        </p>
      ) : (
        rows.map(([label, value]) => (
          <div key={label} className="flex items-center gap-6">
            <span className="w-24 text-text-secondary">{label}</span>
            {usage ? (
              <span className="text-text">{value}</span>
            ) : (
              <span
                aria-hidden="true"
                className="h-4 w-24 rounded-md bg-bg-fill2 motion-safe:animate-pulse"
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}

export function MergeModal({ item, items, onClose, onDone }: Common & { item: TaxonomyItem }) {
  const id = useId();
  const targets = others(items, item.id);
  const [into, setInto] = useState(targets[0]?.value ?? "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const { usage, failed, retry } = useUsage(item.id);
  const target = items.find((i) => i.id === into);

  async function submit() {
    if (!into || busy) return;
    setBusy(true);
    setFailure(null);
    const result = await mergeTaxonomy(item.id, into);
    setBusy(false);
    if (result.ok)
      onDone({
        title: "Merged",
        body: `“${item.name}” now sits under “${target?.name ?? "the other entry"}”.`,
      });
    else setFailure(result);
  }

  return (
    <Modal
      title={`Merge “${item.name}” into another ${item.kind}`}
      subtitle={`Everything tagged “${item.name}” moves to the entry you pick, then “${item.name}” is removed.`}
      icon={<CopyIcon size={24} />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} busy={busy} disabled={!into || failed}>
            Merge tags
          </Button>
        </>
      }
    >
      {targets.length === 0 ? (
        <p className="text-[14px] text-text-secondary leading-5">
          There is nothing to merge into yet. Add another entry first.
        </p>
      ) : (
        <Field label="Merge into" htmlFor={`${id}-into`}>
          <Select id={`${id}-into`} value={into} onChange={setInto} options={targets} />
        </Field>
      )}
      <UsageRows
        usage={usage}
        failed={failed}
        retry={retry}
        rows={[
          ["Resources", usage ? `${plural(usage.resources, "item")} move` : ""],
          ["Paths", usage ? `${plural(usage.paths, "path")} move` : ""],
          ["Search", `“${item.name}” still finds them`],
        ]}
      />
      <ErrorLine failure={failure} />
      <Note icon={<CopyIcon size={16} />}>Logged in the audit log. This can’t be undone.</Note>
    </Modal>
  );
}

export function DeleteModal({ item, items, onClose, onDone }: Common & { item: TaxonomyItem }) {
  const id = useId();
  const targets = others(items, item.id);
  const [mode, setMode] = useState<"move" | "remove">(targets.length > 0 ? "move" : "remove");
  const [into, setInto] = useState(targets[0]?.value ?? "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const { usage, failed, retry } = useUsage(item.id);
  const inUse = !usage || usage.resources + usage.paths > 0;

  async function submit() {
    if (busy || !usage) return;
    setBusy(true);
    setFailure(null);
    const result = await deleteTaxonomy(item.id, inUse && mode === "move" ? into : undefined);
    setBusy(false);
    if (result.ok) onDone({ title: "Deleted", body: `“${item.name}” is gone.` });
    else setFailure(result);
  }

  const useText = usage
    ? `${plural(usage.resources, "resource")} and ${plural(usage.paths, "path")} use this ${item.kind}.`
    : "Checking what uses it…";
  return (
    <Modal
      title={`Delete “${item.name}”?`}
      subtitle={usage && !inUse ? "Nothing uses it yet." : useText}
      icon={<TrashIcon size={24} />}
      tone="danger"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={submit}
            busy={busy}
            disabled={!usage || failed || (inUse && mode === "move" && !into)}
          >
            Delete {item.kind}
          </Button>
        </>
      }
    >
      {failed ? (
        <UsageRows usage={null} failed retry={retry} rows={[]} />
      ) : usage && !inUse ? null : (
        <fieldset className="flex flex-col gap-4 rounded-2xl bg-bg-fill1 p-4">
          <legend className="sr-only">What happens to the items that use it</legend>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="radio"
              name={id}
              checked={mode === "move"}
              disabled={targets.length === 0}
              onChange={() => setMode("move")}
              className="mt-1 size-4 accent-primary"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-2 text-[14px] leading-5">
              <span>
                <span className="block font-medium text-text">Move them to another tag</span>
                <span className="text-[13px] text-text-tertiary">Nothing loses a tag.</span>
              </span>
              {mode === "move" ? (
                <Field label="Move to" htmlFor={`${id}-into`}>
                  <Select id={`${id}-into`} value={into} onChange={setInto} options={targets} />
                </Field>
              ) : null}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="radio"
              name={id}
              checked={mode === "remove"}
              onChange={() => setMode("remove")}
              className="mt-1 size-4 accent-primary"
            />
            <span className="text-[14px] leading-5">
              <span className="block font-medium text-text">Just remove the tag</span>
              <span className="text-[13px] text-text-tertiary">They keep their other tags.</span>
            </span>
          </label>
        </fieldset>
      )}
      <ErrorLine failure={failure} />
      <Note icon={<TrashIcon size={16} />}>Logged in the audit log. This can’t be undone.</Note>
    </Modal>
  );
}

export function AddModal({
  items,
  onClose,
  onDone,
}: Omit<Common, "onDone"> & {
  onDone: (item: { title: string; body: string }) => void;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TaxonomyKind>("tag");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const problem = taxonomyNameError(name, kind, items);

  async function submit() {
    setTouched(true);
    if (problem || busy) return;
    setBusy(true);
    setFailure(null);
    const result = await createTaxonomy({ name: name.trim(), kind });
    setBusy(false);
    if (result.ok)
      onDone({ title: `${KIND_LABEL[kind]} added`, body: `“${name.trim()}” is ready to use.` });
    else setFailure(result);
  }

  return (
    <Modal
      title="Add a topic, tag or level"
      subtitle="Topics group content, tags describe it, levels set difficulty."
      icon={<PlusIcon size={24} />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} busy={busy}>
            Add
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Name" htmlFor={`${id}-name`} error={touched ? problem : null}>
          <input
            id={`${id}-name`}
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={touched && problem ? true : undefined}
            aria-describedby={touched && problem ? `${id}-name-err` : undefined}
            className={INPUT}
          />
        </Field>
        <Field label="Kind" htmlFor={`${id}-kind`}>
          <Select
            id={`${id}-kind`}
            value={kind}
            onChange={(v) => setKind(v as TaxonomyKind)}
            options={TAXONOMY_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          />
        </Field>
        <ErrorLine failure={failure} />
        <button type="submit" className="sr-only" tabIndex={-1}>
          Add
        </button>
      </form>
    </Modal>
  );
}
