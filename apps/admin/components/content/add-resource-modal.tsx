"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { previewLink } from "../../lib/content/api";
import { durationLabel, isHttpUrl, metaLine } from "../../lib/content/format";
import type { LinkPreview } from "../../lib/content/types";
import { useDebounced } from "./hooks";
import { Modal, ModalActions } from "./modal";
import { CheckLine, Field, PlusIcon, Radio, TextInput, Thumb } from "./ui";

type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "error"; message: string }
  | { state: "done"; preview: LinkPreview };

/** RS3 (638:12276) and RS4 (638:19212): paste a link, see what we found, say whether it is free. */
export function AddResourceModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [rights, setRights] = useState<"free_public" | "unsure">("free_public");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const debounced = useDebounced(url.trim(), 500);
  const valid = isHttpUrl(debounced);

  useEffect(() => {
    if (!valid) {
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
  }, [debounced, valid]);

  const typed = url.trim() !== "";
  const urlError =
    typed && !isHttpUrl(url.trim()) ? "Paste a full link that starts with https://" : null;
  const preview = check.state === "done" ? check.preview : null;
  const duplicate = preview?.duplicateOf ?? null;
  const canContinue = preview?.linkOk === true && duplicate === null && rights === "free_public";

  const next = () => {
    if (!canContinue) return;
    router.push(`/resources/new?url=${encodeURIComponent(debounced)}&rights=${rights}`);
  };

  return (
    <Modal
      title="Add a resource"
      subtitle="Paste a link. We’ll check it and fill in what we can."
      icon={<PlusIcon className="size-5" />}
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          confirmLabel="Continue"
          onConfirm={next}
          disabled={!canContinue}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-2xl bg-bg-fill1 p-4">
          <Field label="Link" error={urlError}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                data-autofocus
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://"
                aria-describedby={describedBy}
                invalid={invalid}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    next();
                  }
                }}
              />
            )}
          </Field>

          <div aria-live="polite" className="flex flex-col gap-3">
            {check.state === "checking" ? (
              <p className="text-[13px] text-text-secondary">Checking the link…</p>
            ) : null}
            {check.state === "error" ? (
              <p role="alert" className="text-[13px] text-error-text">
                We couldn’t check that link. {check.message}
              </p>
            ) : null}
            {preview ? (
              <>
                <div className="flex items-center gap-3 rounded-xl bg-bg-base p-3">
                  <Thumb src={preview.thumbnail} className="h-12 w-[72px] shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[14px] leading-5">{preview.title}</p>
                    <p className="truncate text-[12px] text-text-tertiary leading-4">
                      {metaLine([
                        preview.source,
                        preview.creator,
                        durationLabel(preview.durationMin),
                      ])}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <CheckLine ok={preview.linkOk}>
                    {preview.linkOk
                      ? "Link works"
                      : `Link doesn’t work${preview.linkReason ? `: ${preview.linkReason}` : ""}`}
                  </CheckLine>
                  {duplicate ? (
                    <p role="alert" className="text-[13px] text-error-text leading-5">
                      Already in the library as “{duplicate.title}”.{" "}
                      <Link
                        href={`/resources/detail?id=${encodeURIComponent(duplicate.id)}`}
                        className="font-medium underline"
                      >
                        Open it
                      </Link>
                    </p>
                  ) : (
                    <CheckLine ok>Not in the library yet</CheckLine>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="mb-3 font-medium text-[14px] leading-5">
            Is it free to link or embed?
          </legend>
          <Radio
            name="rights"
            checked={rights === "free_public"}
            onChange={() => setRights("free_public")}
            label="Yes, it’s free and public"
            hint="YouTube, a blog post or an open tool"
          />
          <Radio
            name="rights"
            checked={rights === "unsure"}
            onChange={() => setRights("unsure")}
            label="No, or I’m not sure"
            hint="We can’t add paid or private content"
          />
        </fieldset>
      </div>
    </Modal>
  );
}
