"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { adminRequest, isRecord } from "../../lib/api";
import { dismissLinkReport, fixLink, getLinkReport } from "../../lib/review/api";
import { agoLabel, plural, safeHref } from "../../lib/review/format";
import type { LinkReportDetail } from "../../lib/review/types";
import { AssignCard, BackLink, DetailGate, ReporterList, ReviewRoot } from "./detail-parts";
import { Checkbox, Field, TextInput } from "./fields";
import { useLoad } from "./hooks";
import { AlertIcon, CheckIcon, LinkIcon } from "./icons";
import { Modal } from "./modal";
import { useToast } from "./toast";
import { Badge, Button, Card, ExternalLink, FOCUS, PageTitle, Row } from "./ui";
import { messageFor } from "./use-decision";
import { useReviewer } from "./use-reviewer";

const BACK = "/review?tab=link-reports";

export function LinkReportScreen() {
  const id = useSearchParams().get("id") ?? "";
  const { state, reload } = useLoad(`link:${id}`, (signal) => getLinkReport(id, signal));
  const me = useReviewer();
  const [assigned, setAssigned] = useState<{
    id: string;
    value: LinkReportDetail["assignedTo"];
  } | null>(null);
  return (
    <ReviewRoot>
      <DetailGate
        state={
          id === ""
            ? {
                status: "error",
                failure: { ok: false, code: "not_found", message: "", status: 404 },
              }
            : state
        }
        reload={reload}
        backHref={BACK}
        backLabel="Review queues"
        what="report"
      >
        {(r) => (
          <Detail
            report={assigned?.id === r.id ? { ...r, assignedTo: assigned.value } : r}
            meId={me.meId}
            canManage={me.canManage}
            onAssigned={(value) => setAssigned({ id: r.id, value })}
          />
        )}
      </DetailGate>
    </ReviewRoot>
  );
}

const STATUS_BADGE = {
  failed: { tone: "error", text: "Link check failed" },
  redirects: { tone: "warning", text: "Link redirects" },
  ok: { tone: "success", text: "Link check passed" },
} as const;

function Detail({
  report: r,
  meId,
  canManage,
  onAssigned,
}: {
  report: LinkReportDetail;
  meId: string | null;
  canManage: boolean;
  onAssigned: (a: LinkReportDetail["assignedTo"]) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [fixing, setFixing] = useState(false);
  const [busy, setBusy] = useState(false);
  const badge = STATUS_BADGE[r.linkStatus];
  const href = safeHref(r.url);
  const disabled = !canManage || r.resolved;

  async function dismiss() {
    setBusy(true);
    const result = await dismissLinkReport(r.id);
    if (result.ok) {
      toast({ tone: "success", title: "Report dismissed", body: "The link stays as it is." });
      router.push(BACK);
      return;
    }
    setBusy(false);
    if (result.status === 409) {
      toast({ tone: "warning", title: "Already handled", body: result.message });
      router.push(BACK);
      return;
    }
    toast({ tone: "error", title: "Couldn’t dismiss the report", body: messageFor(result) });
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={BACK} label="Review queues" />
      <PageTitle
        title={r.title}
        badge={<Badge tone={badge.tone}>{badge.text}</Badge>}
        subtitle={`Reported by ${plural(r.reportCount, "learner")} · first report ${agoLabel(r.firstReportDays)}`}
        actions={
          <>
            <Button disabled={disabled || busy} onClick={dismiss}>
              Dismiss
            </Button>
            <Button
              variant="primary"
              disabled={disabled || busy || r.resourceId === ""}
              onClick={() => setFixing(true)}
            >
              Replace or retire
            </Button>
          </>
        }
      />
      {r.resolved ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-warning-border bg-warning-accent px-4 py-3 text-[13px] text-warning-text"
        >
          <AlertIcon />
          Already handled. This report was fixed or dismissed.
        </p>
      ) : !canManage ? (
        <p
          role="status"
          className="rounded-xl bg-bg-fill1 px-4 py-3 text-[13px] text-text-secondary"
        >
          You can read this queue but not act on reports. Review queues needs the Manage level.
        </p>
      ) : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <Card title="What learners said">
            <ReporterList reports={r.reports} />
          </Card>
          <Card title="Link check">
            <p
              className={`flex items-center gap-2 text-[13px] ${r.linkCheck.ok ? "text-success-text" : "text-error-text"}`}
            >
              {r.linkCheck.ok ? <CheckIcon /> : <AlertIcon />}
              {r.linkCheck.reason ||
                (r.linkCheck.ok ? "The link works." : "The link check failed.")}
            </p>
            {r.linkCheck.checkedText ? (
              <p className="mt-1 text-[12px] text-text-tertiary">{r.linkCheck.checkedText}</p>
            ) : null}
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card
            title="Resource"
            action={href ? <ExternalLink href={href}>Open</ExternalLink> : null}
          >
            <dl className="m-0">
              <Row label="Type">{r.type}</Row>
              <Row label="Used in">
                {r.usedIn.length > 0 ? r.usedIn.join(", ") : "Library only"}
              </Row>
              <Row label="On it now">{plural(r.learnersNow, "learner")}</Row>
            </dl>
          </Card>
          <AssignCard
            kind="link-reports"
            id={r.id}
            assignedTo={r.assignedTo}
            meId={meId}
            canManage={canManage && !r.resolved}
            onChange={onAssigned}
          />
        </div>
      </div>
      {fixing ? <FixLinkModal report={r} onClose={() => setFixing(false)} /> : null}
    </div>
  );
}

type Check = "idle" | "checking" | "ok" | "bad" | "unknown";

/**
 * Fix broken link. The save is the resources endpoint (POST /resources/:id/fix-link). "Check the
 * link" asks POST /resources/preview whether the new link works. Retiring lives on the resource.
 */
function FixLinkModal({ report: r, onClose }: { report: LinkReportDetail; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [notify, setNotify] = useState(true);
  const [check, setCheck] = useState<Check>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = safeHref(url.trim()) !== null;

  async function runCheck() {
    setCheck("checking");
    const result = await adminRequest(
      "POST",
      "/resources/preview",
      (j) => (isRecord(j) ? j : undefined),
      {
        body: { url: url.trim() },
      },
    );
    if (!result.ok) setCheck("unknown");
    else
      setCheck(
        result.data.linkOk === true ? "ok" : result.data.linkOk === false ? "bad" : "unknown",
      );
  }

  async function save() {
    setBusy(true);
    setError(null);
    const result = await fixLink(r.resourceId, { url: url.trim(), notifyReporters: notify });
    if (result.ok) {
      toast({
        tone: "success",
        title: "Link fixed",
        body: notify
          ? `The ${plural(r.reportCount, "learner")} who reported it will be told.`
          : undefined,
      });
      router.push(BACK);
      return;
    }
    setBusy(false);
    setError(result.fieldErrors?.url ?? messageFor(result));
  }

  return (
    <Modal
      icon={<LinkIcon />}
      title={`Fix “${r.title}”`}
      subtitle={`Reported by ${plural(r.reportCount, "learner")}.${r.linkCheck.reason ? ` ${r.linkCheck.reason}.` : ""}`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid || busy || check === "bad"} onClick={save}>
            {busy ? "Saving…" : "Replace link"}
          </Button>
        </>
      }
    >
      <Field label="New link" htmlFor="rv-fix-url" error={error ?? undefined}>
        <TextInput
          id="rv-fix-url"
          type="url"
          inputMode="url"
          value={url}
          placeholder="https://"
          aria-invalid={error !== null}
          onChange={(e) => {
            setUrl(e.target.value);
            setCheck("idle");
          }}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 text-[13px]" aria-live="polite">
        <Button disabled={!valid || check === "checking"} onClick={runCheck}>
          {check === "checking" ? "Checking…" : "Check the link"}
        </Button>
        {check === "ok" ? (
          <span className="flex items-center gap-1.5 text-success-text">
            <CheckIcon />
            Link works
          </span>
        ) : null}
        {check === "bad" ? (
          <span className="flex items-center gap-1.5 text-error-text">
            <AlertIcon />
            This link doesn’t work
          </span>
        ) : null}
        {check === "unknown" ? (
          <span className="text-text-tertiary">We couldn’t check it. You can still save it.</span>
        ) : null}
      </div>
      <Checkbox checked={notify} onChange={setNotify}>
        Tell the {plural(r.reportCount, "learner")} who reported it
      </Checkbox>
      <p className="text-[12px] text-text-tertiary">
        Want to remove it instead?{" "}
        <Link
          href={`/resources/detail?id=${encodeURIComponent(r.resourceId)}`}
          className={`rounded font-medium text-primary-text underline ${FOCUS}`}
        >
          Retire it from the resource
        </Link>
        .
      </p>
    </Modal>
  );
}
