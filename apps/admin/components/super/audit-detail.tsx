"use client";

import { cn } from "@matr/ui";
import Link from "next/link";
import { useState } from "react";
import { getAuditEntry } from "../../lib/super/api";
import { actionLabel, confirmedWithLabel } from "../../lib/super/audit";
import { firstName, whenLabel } from "../../lib/super/format";
import { useLoader } from "../../lib/super/hooks";
import type { AuditEntry } from "../../lib/super/types";
import { LockIcon, ScrollIcon } from "./icons";
import { Inset, Modal } from "./modal";
import { Button, FOCUS, Skeleton } from "./ui";

/**
 * Entry detail (Figma SA5.2) as a dialog. `entry` is the row already on screen; when only an id is
 * known (a shared ?entry= link) the entry is fetched from GET /audit/:id.
 */
export function AuditDetail({
  entry,
  entryId,
  onClose,
}: {
  entry: AuditEntry | null;
  entryId: string;
  onClose: () => void;
}) {
  const fetched = useLoader(
    () => (entry ? Promise.resolve({ ok: true as const, data: entry }) : getAuditEntry(entryId)),
    [entry, entryId],
  );
  const [now] = useState(() => Date.now());
  const data = fetched.state.status === "ready" ? fetched.state.data : null;
  const footer = (
    <>
      <Button onClick={onClose}>Close</Button>
      {data?.targetId &&
      data.action.startsWith("admin.") &&
      !data.action.startsWith("admin.role.") &&
      !data.action.startsWith("admin.invite.") ? (
        <Link
          href={`/team/detail?id=${encodeURIComponent(data.targetId)}`}
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-lg bg-ink px-3.5 font-medium text-[14px] text-bg-base",
            FOCUS,
          )}
        >
          Open {firstName(data.targetLabel || "profile")}’s profile
        </Link>
      ) : null}
    </>
  );

  const rows: [string, string][] = data
    ? (
        [
          ["Person", data.targetLabel || data.targetId],
          ["Before", data.before],
          ["After", data.after],
          ["Confirmed with", confirmedWithLabel(data.confirmedWith)],
          ["Device", [data.device, data.ip].filter(Boolean).join(" · ")],
        ] as [string, string][]
      ).filter(([, v]) => v)
    : [];

  return (
    <Modal
      icon={<ScrollIcon />}
      title={data ? actionLabel(data.action) : "Audit entry"}
      subtitle={
        data
          ? `${whenLabel(data.at, now)} · by ${data.actorName}${data.actorRole ? ` (${data.actorRole})` : ""}`
          : fetched.state.status === "error"
            ? "We couldn’t load this entry."
            : "Loading…"
      }
      onClose={onClose}
      footer={footer}
    >
      {fetched.state.status === "loading" ? (
        <Inset>
          <Skeleton className="h-20 w-full" />
        </Inset>
      ) : fetched.state.status === "error" ? (
        <p role="alert" className="text-[14px] text-error-text">
          {fetched.state.code === "not_found" ? "That entry doesn’t exist." : fetched.state.message}{" "}
          {fetched.state.code === "not_found" ? null : (
            <button type="button" onClick={fetched.reload} className={cn("underline", FOCUS)}>
              Try again
            </button>
          )}
        </p>
      ) : (
        <Inset>
          <dl className="flex flex-col gap-3">
            {rows.length === 0 ? (
              <p className="text-[14px] text-text-secondary">No extra detail was recorded.</p>
            ) : (
              rows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_1fr] gap-3 text-[14px] leading-5">
                  <dt className="text-text-tertiary">{label}</dt>
                  <dd className="min-w-0 break-words text-text">{value}</dd>
                </div>
              ))
            )}
          </dl>
        </Inset>
      )}
      <div className="flex items-start gap-2.5 rounded-xl bg-bg-fill1 px-3.5 py-3 text-[13px] text-text-secondary">
        <LockIcon size={16} className="mt-px shrink-0" />
        <p>Audit entries can’t be edited or deleted.</p>
      </div>
    </Modal>
  );
}
