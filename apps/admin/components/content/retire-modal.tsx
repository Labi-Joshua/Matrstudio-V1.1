"use client";

import { useState } from "react";
import { retireResource } from "../../lib/content/api";
import { plural } from "../../lib/content/format";
import type { ResourceDetail } from "../../lib/content/types";
import { Modal, ModalActions } from "./modal";
import { Banner, Checkbox, TrashIcon } from "./ui";

/** RS10 (641:15202): confirm retiring, with the live paths it will leave with empty lessons. */
export function RetireModal({
  resource,
  onClose,
  onDone,
}: {
  resource: ResourceDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const livePaths = resource.usedIn.filter((u) => u.pathStatus === "live");
  const [notify, setNotify] = useState(livePaths.length > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retire() {
    setBusy(true);
    setError(null);
    const result = await retireResource(resource.id, notify && livePaths.length > 0);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDone();
  }

  return (
    <Modal
      title="Retire this resource?"
      subtitle={`“${resource.title}” leaves the library. Learners who saved it will see that it’s been retired.`}
      icon={<TrashIcon className="size-5" />}
      tone="danger"
      onClose={onClose}
      busy={busy}
      footer={
        <ModalActions
          onCancel={onClose}
          confirmLabel="Retire resource"
          onConfirm={retire}
          busy={busy}
          danger
        />
      }
    >
      <div className="flex flex-col gap-4">
        {livePaths.length > 0 ? (
          <>
            <Banner>
              Used in {plural(livePaths.length, "live path")}. These lessons will be flagged as
              empty until you swap in a new resource.
            </Banner>
            <ul className="flex flex-col gap-3 rounded-2xl bg-bg-fill1 p-4 text-[13px] leading-5">
              {livePaths.map((u) => (
                <li
                  key={`${u.pathId}-${u.moduleNumber}-${u.lessonNumber}`}
                  className="flex flex-wrap justify-between gap-x-4"
                >
                  <span className="font-medium">{u.pathTitle}</span>
                  <span className="text-text-secondary">
                    Module {u.moduleNumber} · Lesson {u.lessonNumber}
                  </span>
                </li>
              ))}
            </ul>
            <Checkbox checked={notify} onChange={setNotify} label="Email the path owners" />
          </>
        ) : (
          <p className="text-[14px] text-text-secondary leading-5">
            It isn’t used in any live path, so no lessons will be affected.
          </p>
        )}
        {error ? (
          <p role="alert" className="text-[13px] text-error-text">
            Nothing was changed. {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
