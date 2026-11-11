"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { dismissProfileReport, getProfileReport, hideProfile } from "../../lib/review/api";
import { agoLabel, hideMessage, plural, safeHref } from "../../lib/review/format";
import { HIDE_REASONS } from "../../lib/review/options";
import type { ProfileReportDetail } from "../../lib/review/types";
import { AssignCard, BackLink, DetailGate, ReporterList, ReviewRoot } from "./detail-parts";
import { Checkbox, Field, Select, TextArea } from "./fields";
import { useLoad } from "./hooks";
import { AlertIcon, LockIcon, LogIcon } from "./icons";
import { Modal } from "./modal";
import { useToast } from "./toast";
import { Avatar, Badge, Button, Card, ExternalLink, PageTitle, Row } from "./ui";
import { messageFor } from "./use-decision";
import { useReviewer } from "./use-reviewer";

const BACK = "/review?tab=profile-reports";
const handleOf = (h: string) => h.replace(/^@/, "");

export function ProfileReportScreen() {
  const id = useSearchParams().get("id") ?? "";
  const { state, reload } = useLoad(`profile:${id}`, (signal) => getProfileReport(id, signal));
  const me = useReviewer();
  const [assigned, setAssigned] = useState<{
    id: string;
    value: ProfileReportDetail["assignedTo"];
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

function Detail({
  report: r,
  meId,
  canManage,
  onAssigned,
}: {
  report: ProfileReportDetail;
  meId: string | null;
  canManage: boolean;
  onAssigned: (a: ProfileReportDetail["assignedTo"]) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [hiding, setHiding] = useState(false);
  const [busy, setBusy] = useState(false);
  const disabled = !canManage || r.resolved;
  const profile = safeHref(r.profileUrl);

  async function dismiss() {
    setBusy(true);
    const result = await dismissProfileReport(r.id);
    if (result.ok) {
      toast({ tone: "success", title: "Report dismissed", body: "The profile stays public." });
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
        title={`Report on @${handleOf(r.handle)}`}
        badge={r.reason ? <Badge tone="primary">{r.reason}</Badge> : null}
        subtitle={`Public profile · ${plural(r.reportCount, "report")} · ${agoLabel(r.ageDays)}`}
        actions={
          <>
            <Button disabled={disabled || busy} onClick={dismiss}>
              Dismiss
            </Button>
            <Button variant="danger" disabled={disabled || busy} onClick={() => setHiding(true)}>
              Hide profile
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
          Already handled. This report was dismissed or the profile is hidden.
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
          <Card
            title="Public profile"
            action={profile ? <ExternalLink href={profile}>Open profile</ExternalLink> : null}
          >
            <div className="flex items-center gap-3">
              <Avatar name={r.name} url={r.avatarUrl} size={48} />
              <div className="text-[13px]">
                <p className="font-medium text-text">{r.name}</p>
                <p className="text-text-tertiary">
                  @{handleOf(r.handle)} · joined {r.facts.joined}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-bg-fill1 p-3 text-[13px]">
              <p className="text-text-tertiary">Bio</p>
              <p className="mt-0.5 break-words text-text">{r.bio || "No bio."}</p>
              {r.links.length > 0 ? (
                <p className="mt-1 break-words text-error-text">Links: {r.links.join(" · ")}</p>
              ) : null}
            </div>
          </Card>
          <Card title="What people said">
            <ReporterList reports={r.reports} />
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card title="Account">
            <dl className="m-0">
              <Row label="Joined">{r.facts.joined}</Row>
              <Row label="Paths started">{r.facts.pathsStarted}</Row>
              <Row label="Submissions">{r.facts.submissions}</Row>
              <Row label="Past reports">
                {r.facts.pastReports === 0 ? "None" : r.facts.pastReports}
              </Row>
            </dl>
          </Card>
          <Card title="Community guidelines">
            <p className="text-[13px] text-text-secondary">
              No selling, ads or misleading links on public profiles.
            </p>
          </Card>
          <AssignCard
            kind="profile-reports"
            id={r.id}
            assignedTo={r.assignedTo}
            meId={meId}
            canManage={canManage && !r.resolved}
            onChange={onAssigned}
          />
        </div>
      </div>
      {hiding ? <HideModal report={r} onClose={() => setHiding(false)} /> : null}
    </div>
  );
}

/** RQ14: hide the public page only; the account still works. The message is editable. */
function HideModal({ report: r, onClose }: { report: ProfileReportDetail; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState(HIDE_REASONS[0]?.value ?? "spam");
  const [message, setMessage] = useState(hideMessage(HIDE_REASONS[0]?.phrase ?? ""));
  const [edited, setEdited] = useState(false);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(value: string) {
    setReason(value);
    // Keep the wording in step with the reason until the admin has edited the message.
    if (!edited) setMessage(hideMessage(HIDE_REASONS.find((h) => h.value === value)?.phrase ?? ""));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await hideProfile(r.id, { message: message.trim(), notifyReporters: notify });
    if (result.ok) {
      toast({ tone: "success", title: "Profile hidden", body: "Their account still works." });
      router.push(BACK);
      return;
    }
    setBusy(false);
    if (result.status === 409) {
      toast({ tone: "warning", title: "Already handled", body: result.message });
      router.push(BACK);
      return;
    }
    setError(messageFor(result));
  }

  return (
    <Modal
      tone="danger"
      icon={<LockIcon />}
      title={`Hide @${handleOf(r.handle)}’s public profile?`}
      subtitle="Their account still works. Only the public page is hidden."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy || message.trim() === ""} onClick={submit}>
            {busy ? "Hiding…" : "Hide profile"}
          </Button>
        </>
      }
    >
      <Field label="Reason" htmlFor="rv-hide-reason">
        <Select
          id="rv-hide-reason"
          value={reason}
          options={HIDE_REASONS}
          onChange={(e) => pick(e.target.value)}
        />
      </Field>
      <Field label="Message they’ll see" htmlFor="rv-hide-message">
        <TextArea
          id="rv-hide-message"
          value={message}
          rows={4}
          maxLength={1000}
          onChange={(e) => {
            setMessage(e.target.value);
            setEdited(true);
          }}
        />
      </Field>
      <Checkbox checked={notify} onChange={setNotify}>
        Tell the {plural(r.reportCount, "person", "people")} who reported it that it was handled
      </Checkbox>
      <p className="flex items-center gap-2 rounded-xl bg-bg-fill1 px-4 py-3 text-[13px] text-text-secondary">
        <LogIcon />
        Logged in the audit log with your name.
      </p>
      {error ? (
        <p role="alert" className="text-[13px] text-error-text">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
