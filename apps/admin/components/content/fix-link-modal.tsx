"use client";

import { useEffect, useState } from "react";
import { fixResourceLink, getResource, previewLink, retireResource } from "../../lib/content/api";
import { isHttpUrl, plural } from "../../lib/content/format";
import type { LinkPreview, ResourceDetail } from "../../lib/content/types";
import { useDebounced, useLoad } from "./hooks";
import { Modal, ModalActions } from "./modal";
import { Button, Checkbox, CheckLine, Field, LinkIcon, Radio, Skeleton, TextInput } from "./ui";

/** RS9 (641:9914): replace a broken link (and tell the people who reported it) or retire the resource. */
export function FixLinkModal({
  resourceId,
  title,
  onClose,
  onDone,
}: {
  resourceId: string;
  title: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { load, reload } = useLoad(`fix-${resourceId}`, (signal) =>
    getResource(resourceId, signal),
  );
  return (
    <Modal
      title={`Fix “${title}”`}
      subtitle={subtitleFor(load.state === "ready" ? load.data : null)}
      icon={<LinkIcon className="size-5" />}
      onClose={onClose}
      footer={
        load.state === "ready" ? null : (
          <Button onClick={onClose}>{load.state === "error" ? "Close" : "Cancel"}</Button>
        )
      }
    >
      {load.state === "loading" ? (
        <div role="status" aria-label="Loading the resource" className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : load.state === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-[14px]">We couldn’t load this resource. {load.failure.message}</p>
          <Button onClick={reload}>Try again</Button>
        </div>
      ) : (
        <FixForm resource={load.data} onClose={onClose} onDone={onDone} />
      )}
    </Modal>
  );
}

function subtitleFor(r: ResourceDetail | null): string {
  if (!r) return "Checking what happened.";
  const bits = [
    r.reporters > 0 ? `Reported by ${plural(r.reporters, "learner")}.` : "",
    r.linkCheck.failures > 0
      ? `Our link check failed ${r.linkCheck.failures === 2 ? "twice" : `${r.linkCheck.failures} times`}.`
      : "",
  ].filter(Boolean);
  return bits.join(" ") || "The link needs attention.";
}

function FixForm({
  resource,
  onClose,
  onDone,
}: {
  resource: ResourceDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState<"replace" | "retire">("replace");
  const [url, setUrl] = useState("");
  const [notify, setNotify] = useState(resource.reporters > 0);
  const [check, setCheck] = useState<
    | { state: "idle" | "checking" }
    | { state: "done"; preview: LinkPreview }
    | { state: "error"; message: string }
  >({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounced(url.trim(), 500);
  const valid = isHttpUrl(debounced);

  useEffect(() => {
    if (mode !== "replace" || !valid) {
      setCheck({ state: "idle" });
      return;
    }
    const ctrl = new AbortController();
    setCheck({ state: "checking" });
    previewLink(debounced, ctrl.signal).then((result) => {
      if (ctrl.signal.aborted) return;
      setCheck(
        result.ok
          ? { state: "done", preview: result.data }
          : { state: "error", message: result.message },
      );
    });
    return () => ctrl.abort();
  }, [debounced, valid, mode]);

  const sameLink = valid && debounced === resource.url;
  const works = check.state === "done" && check.preview.linkOk && !sameLink;
  const usedIn = resource.usedIn.length;
  const canSave = mode === "retire" || works;

  async function save() {
    setBusy(true);
    setError(null);
    const result =
      mode === "replace"
        ? await fixResourceLink(resource.id, debounced, notify)
        : await retireResource(resource.id, false);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDone(mode === "replace" ? "Link replaced" : "Resource retired");
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl bg-bg-fill1 p-4">
          <p className="font-medium text-[14px] leading-5">Current link</p>
          <p className="mt-2 break-all text-[13px] text-text-tertiary leading-5">
            {resource.url || "—"}
          </p>
          {resource.linkCheck.reason ? (
            <p className="mt-2 text-[13px] text-error-text leading-5">
              {resource.linkCheck.reason}
            </p>
          ) : null}
        </div>

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="mb-3 font-medium text-[14px] leading-5">
            What do you want to do?
          </legend>
          <Radio
            name="fix-mode"
            checked={mode === "replace"}
            onChange={() => setMode("replace")}
            label="Replace the link"
            hint={
              usedIn > 0
                ? `Keep the record, intro and its place in ${resource.usedIn.map((u) => u.pathTitle).join(", ")}`
                : "Keep the record and intro"
            }
          >
            <Field label="New link">
              {({ id, describedBy }) => (
                <TextInput
                  id={id}
                  data-autofocus
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://"
                  disabled={mode !== "replace"}
                  aria-describedby={describedBy}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              )}
            </Field>
            <div aria-live="polite" className="mt-1.5">
              {check.state === "checking" ? (
                <p className="text-[13px] text-text-secondary">Checking the link…</p>
              ) : null}
              {check.state === "error" ? (
                <p role="alert" className="text-[13px] text-error-text">
                  We couldn’t check that link. {check.message}
                </p>
              ) : null}
              {sameLink ? (
                <p className="text-[13px] text-error-text">
                  That’s the link that’s failing. Paste a new one.
                </p>
              ) : check.state === "done" ? (
                <CheckLine ok={check.preview.linkOk}>
                  {check.preview.linkOk
                    ? "Link works"
                    : `Link doesn’t work${check.preview.linkReason ? `: ${check.preview.linkReason}` : ""}`}
                </CheckLine>
              ) : null}
            </div>
          </Radio>
          <Radio
            name="fix-mode"
            checked={mode === "retire"}
            onChange={() => setMode("retire")}
            label="Retire it"
            hint={`Take it out of the library${usedIn > 0 ? ` and ${plural(usedIn, "path")}` : ""}`}
          />
        </fieldset>

        {mode === "replace" && resource.reporters > 0 ? (
          <Checkbox
            checked={notify}
            onChange={setNotify}
            label={`Tell the ${plural(resource.reporters, "learner")} who reported it`}
          />
        ) : null}

        {error ? (
          <p role="alert" className="text-[13px] text-error-text">
            Nothing was changed. {error}
          </p>
        ) : null}
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <ModalActions
          onCancel={onClose}
          confirmLabel={mode === "replace" ? "Save new link" : "Retire resource"}
          onConfirm={save}
          busy={busy}
          disabled={!canSave}
          danger={mode === "retire"}
        />
      </div>
    </>
  );
}
