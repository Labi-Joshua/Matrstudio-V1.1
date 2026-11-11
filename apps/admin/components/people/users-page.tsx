"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useRef, useState } from "react";
import type { UserList } from "../../lib/people/types";
import { useAccess } from "./hooks";
import { ToastProvider, useToast } from "./toast";
import { BTN_SECONDARY, Chip, PageHeader } from "./ui";
import { type ExportFn, UsersList } from "./users-list";
import { Waitlist } from "./waitlist";

const fmt = (n: number | null) => (n === null ? null : n.toLocaleString("en-GB"));

/** Page body for /users: the Users and Waitlist tabs (Figma "Users and waitlist" US1, US7). */
export function UsersPage() {
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <Inner />
      </Suspense>
    </ToastProvider>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "waitlist" ? "waitlist" : "users";
  const access = useAccess();
  const toast = useToast();
  const [totals, setTotals] = useState<UserList["totals"]>({ learners: null, waitlist: null });
  const [waiting, setWaiting] = useState<number | null>(null);
  const exportRef = useRef<ExportFn>(null);
  const registerExport = useCallback((fn: ExportFn) => {
    exportRef.current = fn;
  }, []);

  const learners = fmt(totals.learners);
  const waitlist = fmt(waiting ?? totals.waitlist);
  const intro = [learners && `${learners} learners`, waitlist && `${waitlist} on the waitlist`]
    .filter(Boolean)
    .join(" · ");

  function exportCsv() {
    const out = exportRef.current?.();
    if (!out || out.rows === 0) {
      toast({ tone: "info", title: "Nothing to export", body: "There are no rows on screen." });
      return;
    }
    const url = URL.createObjectURL(new Blob([`﻿${out.csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = out.name;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      tone: "success",
      title: "CSV downloaded",
      body: `${out.rows.toLocaleString("en-GB")} rows, the ones loaded on screen.`,
    });
  }

  const go = (next: "users" | "waitlist") =>
    router.replace(next === "users" ? "/users" : "/users?tab=waitlist");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users and waitlist"
        intro={intro || undefined}
        aside={
          <button type="button" onClick={exportCsv} className={BTN_SECONDARY}>
            Export CSV
          </button>
        }
      />
      <div role="tablist" aria-label="People" className="flex flex-wrap gap-2">
        <Chip
          role="tab"
          selected={tab === "users"}
          onClick={() => go("users")}
          count={totals.learners}
        >
          Users
        </Chip>
        <Chip
          role="tab"
          selected={tab === "waitlist"}
          onClick={() => go("waitlist")}
          count={waiting ?? totals.waitlist}
        >
          Waitlist
        </Chip>
      </div>
      {tab === "users" ? (
        <UsersList onTotals={setTotals} registerExport={registerExport} />
      ) : (
        <Waitlist
          canManage={access?.users === "manage"}
          onWaiting={setWaiting}
          registerExport={registerExport}
        />
      )}
    </div>
  );
}
