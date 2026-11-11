"use client";

import { cn } from "@matr/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { type AuditQuery, exportAudit, getAudit, getTeam } from "../../lib/super/api";
import {
  ACTION_FILTERS,
  actionLabel,
  DATE_RANGES,
  DEFAULT_RANGE,
  rangeFrom,
} from "../../lib/super/audit";
import { whenLabel } from "../../lib/super/format";
import { useOnlineStatus, useSkeletonGate } from "../../lib/super/hooks";
import type { AuditEntry } from "../../lib/super/types";
import { can, useMe } from "../../lib/super/use-me";
import { AuditDetail } from "./audit-detail";
import { UploadIcon } from "./icons";
import { useToast } from "./toast";
import {
  Avatar,
  Button,
  CARD,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Select,
  Skeleton,
} from "./ui";

const GRID = "md:grid md:grid-cols-[1fr_1.4fr_1.2fr_1.6fr_0.5fr] md:items-center";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: AuditEntry[]; next: string | null };

/** Audit log (Figma SA5.1, SA5.2, empty 673:27433): filters, entries, detail dialog, CSV export. */
export function AuditScreen() {
  const toast = useToast();
  const router = useRouter();
  const search = useSearchParams();
  const me = useMe();
  const online = useOnlineStatus();
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [range, setRange] = useState<string>(DEFAULT_RANGE);
  const [state, setState] = useState<State>({ status: "loading" });
  const [more, setMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [now] = useState(() => Date.now());
  const live = useRef<HTMLParagraphElement>(null);
  const showSkeleton = useSkeletonGate(state.status === "loading");
  const entryId = search.get("entry") ?? "";

  const query = useCallback(
    (cursor?: string): AuditQuery => ({
      actor: actor || undefined,
      action: action || undefined,
      from: rangeFrom(range),
      cursor,
    }),
    [actor, action, range],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt re-runs the load on Try again
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getAudit(query()).then((r) => {
      if (!current) return;
      if (r.ok) {
        setState({ status: "ready", entries: r.data.entries, next: r.data.nextCursor });
        if (live.current) live.current.textContent = `${r.data.entries.length} entries.`;
      } else setState({ status: "error", message: r.message });
    });
    return () => {
      current = false;
    };
  }, [query, attempt]);

  useEffect(() => {
    // The Person filter lists the team; viewers without Admin team: View just get "All admins".
    getTeam().then((r) => {
      if (r.ok) setPeople(r.data.map((m) => ({ id: m.id, name: m.name })));
    });
  }, []);

  const loadMore = async () => {
    if (state.status !== "ready" || !state.next) return;
    setMore(true);
    const r = await getAudit(query(state.next));
    setMore(false);
    if (r.ok) {
      setState({
        status: "ready",
        entries: [...state.entries, ...r.data.entries],
        next: r.data.nextCursor,
      });
    } else toast({ tone: "error", title: "Couldn’t load more", body: r.message });
  };

  const setEntry = (id: string | null) => {
    const params = new URLSearchParams(search.toString());
    if (id) params.set("entry", id);
    else params.delete("entry");
    const text = params.toString();
    router.replace(text ? `/audit?${text}` : "/audit", { scroll: false });
  };

  const download = async () => {
    setExporting(true);
    const result = await exportAudit(query());
    setExporting(false);
    if (!result.ok) {
      toast({ tone: "error", title: "Export failed", body: result.message });
      return;
    }
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ tone: "success", title: "Export ready", body: "The CSV matches your filters." });
  };

  const filtered = Boolean(actor || action || range !== "all");
  const entries = state.status === "ready" ? state.entries : [];
  const open = entryId ? (entries.find((e) => e.id === entryId) ?? null) : null;

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every change made by an admin. Entries can’t be edited or deleted."
        actions={
          can(me, "audit_log", "view") ? (
            <Button onClick={download} disabled={exporting} aria-busy={exporting}>
              <UploadIcon size={18} />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          ) : null
        }
      />
      <p ref={live} className="sr-only" aria-live="polite" />
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Person" htmlFor="audit-person">
          <Select id="audit-person" value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">All admins</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Action" htmlFor="audit-action">
          <Select id="audit-action" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {ACTION_FILTERS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="audit-date">
          <Select id="audit-date" value={range} onChange={(e) => setRange(e.target.value)}>
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {state.status === "error" ? (
        <div className={CARD}>
          <ErrorState
            offline={!online}
            title={online ? "We couldn’t load the audit log" : "You’re offline"}
            body="Try again in a moment. Nothing was changed."
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      ) : state.status === "loading" ? (
        showSkeleton ? (
          <div className={cn(CARD, "overflow-hidden")} aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-border-soft border-b px-4 py-3.5 last:border-b-0"
              >
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-3.5 w-48 max-w-full" />
              </div>
            ))}
          </div>
        ) : null
      ) : entries.length === 0 ? (
        <div className={CARD}>
          <EmptyState
            title={filtered ? "No entries match these filters" : "Nothing logged yet"}
            body={
              filtered
                ? "Try a wider date range or clear a filter."
                : "Changes made by admins show up here."
            }
            action={
              filtered ? (
                <Button
                  onClick={() => {
                    setActor("");
                    setAction("");
                    setRange("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className={cn(CARD, "overflow-hidden")}>
            <div
              aria-hidden="true"
              className={cn(
                "hidden h-10 border-border-soft border-b bg-bg-fill1 px-4 font-medium text-[14px] text-text-secondary",
                GRID,
              )}
            >
              <span>When</span>
              <span>Who</span>
              <span>Action</span>
              <span>Target</span>
              <span />
            </div>
            <ul>
              {entries.map((e) => (
                <li
                  key={e.id}
                  className={cn(
                    "flex flex-col gap-2 border-border-soft border-b px-4 py-3 last:border-b-0",
                    GRID,
                  )}
                >
                  <span className="text-[14px] text-text leading-5">{whenLabel(e.at, now)}</span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={e.actorName} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] text-text leading-5">
                        {e.actorName}
                      </span>
                      {e.actorRole ? (
                        <span className="block truncate text-[12px] text-text-tertiary leading-4">
                          {e.actorRole}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="text-[14px] text-text leading-5">{actionLabel(e.action)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-text leading-5">
                      {e.targetLabel || e.targetId || "—"}
                    </span>
                    {e.summary ? (
                      <span className="block truncate text-[12px] text-text-tertiary leading-4">
                        {e.summary}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    kind="link"
                    className="w-fit text-text md:justify-self-end"
                    onClick={() => setEntry(e.id)}
                    aria-label={`View details: ${actionLabel(e.action)}, ${whenLabel(e.at, now)}`}
                  >
                    View
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          {state.status === "ready" && state.next ? (
            <Button className="self-center" onClick={loadMore} disabled={more} aria-busy={more}>
              {more ? "Loading…" : "Load more"}
            </Button>
          ) : null}
        </div>
      )}

      {entryId ? (
        <AuditDetail entry={open} entryId={entryId} onClose={() => setEntry(null)} />
      ) : null}
    </>
  );
}
