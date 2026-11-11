"use client";

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { getAccess } from "../../lib/settings/api";
import { accessFor, TABS, tabFromSearch } from "../../lib/settings/logic";
import type { SettingsTab } from "../../lib/settings/types";
import { HomeTab } from "./home-tab";
import { NudgesTab } from "./nudges-tab";
import { Modal, ToastProvider } from "./overlay";
import { BAR, LoadError, useLoaded, useSkeletonGate } from "./state";
import type { TabProps } from "./tab-props";
import { TargetsTab } from "./targets-tab";
import { TaxonomyTab } from "./taxonomy-tab";
import { TemplatesTab } from "./templates-tab";
import { Button, FOCUS, XIcon } from "./ui";

const PANELS: Record<SettingsTab, (props: TabProps) => React.ReactNode> = {
  topics: (p) => <TaxonomyTab {...p} />,
  home: (p) => <HomeTab {...p} />,
  templates: (p) => <TemplatesTab {...p} />,
  nudges: (p) => <NudgesTab {...p} />,
  targets: (p) => <TargetsTab {...p} />,
};

function readSearch() {
  return typeof window === "undefined" ? "" : window.location.search;
}

function Page() {
  const { state, reload } = useLoaded((signal) => getAccess({ signal }));
  const showSkeleton = useSkeletonGate(state.status === "loading");
  const access = state.status === "ready" ? accessFor(state.data) : null;
  const tabKey = access?.tabs.join(",") ?? "";
  const [tab, setTab] = useState<SettingsTab | null>(null);
  const [pending, setPending] = useState<SettingsTab | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const dirty = useRef(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onDirty = useCallback((d: boolean) => {
    dirty.current = d;
  }, []);

  // The tab lives in ?tab= (static export: no dynamic segment); back and forward follow it.
  useEffect(() => {
    if (!tabKey) return;
    const allowed = tabKey.split(",") as SettingsTab[];
    const apply = () => setTab(tabFromSearch(readSearch(), allowed) ?? null);
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, [tabKey]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function go(next: SettingsTab) {
    if (next === tab) return;
    if (dirty.current) return setPending(next);
    commit(next);
  }
  function commit(next: SettingsTab) {
    dirty.current = false;
    window.history.pushState(null, "", `?tab=${next}`);
    setTab(next);
    setPending(null);
  }

  function onKey(event: KeyboardEvent, index: number) {
    if (!access) return;
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: access.tabs.length - 1,
    };
    const to = keys[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const id = access.tabs[(to + access.tabs.length) % access.tabs.length];
    if (id) {
      tabRefs.current[id]?.focus();
      go(id);
    }
  }

  const visible = TABS.filter((t) => access?.tabs.includes(t.id));

  return (
    <div className="flex flex-col gap-6 px-4 py-6 md:px-8 md:py-8 xl:px-12">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-medium text-[28px] text-text leading-9 tracking-[-0.56px]">
            Settings
          </h1>
          <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
            Curators only see Home curation. Every change is logged.
          </p>
        </div>
        <div ref={setSlot} className="shrink-0" />
      </div>
      {state.status === "loading" ? (
        <div role="status" aria-busy="true">
          <p className="sr-only">Loading Settings</p>
          {showSkeleton ? (
            <div aria-hidden="true" className="flex flex-col gap-4">
              <div className="flex gap-2">
                {["a", "b", "c", "d", "e"].map((k) => (
                  <div key={k} className={`${BAR} h-9 w-24 rounded-full`} />
                ))}
              </div>
              <div className={`${BAR} h-64 rounded-2xl`} />
            </div>
          ) : null}
        </div>
      ) : state.status === "error" ? (
        <LoadError what="Settings" failure={state.failure} onRetry={reload} />
      ) : !access || access.tabs.length === 0 ? (
        <p
          role="status"
          className="rounded-2xl border border-border-soft border-dashed px-6 py-16 text-center text-[14px] text-text-secondary"
        >
          Your role doesn’t include Settings.
        </p>
      ) : (
        <>
          <div role="tablist" aria-label="Settings sections" className="flex flex-wrap gap-2">
            {visible.map((t, index) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                id={`settings-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls="settings-panel"
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => go(t.id)}
                onKeyDown={(event) => onKey(event, index)}
                className={`h-9 rounded-full border px-3.5 text-[14px] leading-5 tracking-[-0.14px] transition-colors ${FOCUS} ${tab === t.id ? "border-ink bg-ink text-bg-base" : "border-border-soft bg-bg-base text-text-secondary hover:bg-bg-fill1"}`}
              >
                <span className="md:hidden">{t.short}</span>
                <span className="hidden md:inline">{t.label}</span>
              </button>
            ))}
          </div>
          <div
            id="settings-panel"
            role="tabpanel"
            aria-labelledby={tab ? `settings-tab-${tab}` : undefined}
          >
            {tab
              ? PANELS[tab]({
                  canEdit: access.editable.includes(tab),
                  actions: slot,
                  onDirty,
                })
              : null}
          </div>
        </>
      )}
      {pending ? (
        <Modal
          title="Discard your changes?"
          subtitle="You have changes on this tab that aren’t saved."
          icon={<XIcon size={24} />}
          onClose={() => setPending(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPending(null)}>
                Keep editing
              </Button>
              <Button variant="danger" onClick={() => commit(pending)}>
                Discard changes
              </Button>
            </>
          }
        >
          <p className="text-[14px] text-text-secondary leading-5">
            Leaving now loses them. Nothing has been sent to the server.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

export function SettingsPage() {
  return (
    <ToastProvider>
      <Page />
    </ToastProvider>
  );
}
