"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { normaliseCommandQuery, queryTerms } from "../../lib/app/command-match";
import { addRecent, moveActive, readRecent, writeRecent } from "../../lib/app/command-recent";
import {
  buildCommandIndex,
  type CommandRow,
  emptyGroups,
  flattenGroups,
  searchGroups,
  seeAllHref,
  seeAllRow,
} from "../../lib/app/command-search";
import { trapTarget } from "../../lib/app/submit-dialog";
import { getCatalogue } from "../../lib/catalogue/data";
import { SearchIcon } from "../app/icons";
import { useOverlays } from "../app/overlays";
import { FOCUS } from "../app/ui";
import { StateArt } from "../app-library/art";
import { applyTheme, Kbd, Option } from "./parts";

// A listbox may only contain options and groups; a fieldset is not allowed there.
const groupProps = (label: { "aria-labelledby": string } | { "aria-label": string }) => ({
  role: "group",
  ...label,
});

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Built once: the catalogue is static, so there is nothing to wait for.
let cachedIndex: ReturnType<typeof buildCommandIndex> | null = null;
const getIndex = () => {
  cachedIndex ??= buildCommandIndex(getCatalogue());
  return cachedIndex;
};

const BTN =
  "btn-lift inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-base px-3 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] shadow-e1";

/**
 * The ⌘K / Ctrl+K command palette. An extension of the design, not a copy of a frame (Figma has
 * only the top-bar field with its "⌘K" hint and the search results page it leads to): a centred
 * 640px panel on desktop and tablet, a full-screen sheet on phones, in the same surfaces, radii,
 * borders and shadow as the other dialogs. It is a modal dialog around an editable combobox: focus
 * stays in the input and the active row is announced through aria-activedescendant.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { openSubmit } = useOverlays();
  const uid = useId();
  const titleId = `${uid}-title`;
  const listId = `${uid}-list`;
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  // null = nothing chosen yet: a typed query then goes to the results page on Enter.
  const [active, setActive] = useState<number | null>(0);

  const terms = useMemo(() => queryTerms(query), [query]);
  const typed = terms.length > 0;
  const groups = useMemo(
    () => (typed ? searchGroups(getIndex(), query) : emptyGroups(recent)),
    [typed, query, recent],
  );
  const rows = useMemo(() => {
    const list = flattenGroups(groups);
    return typed && list.length > 0 ? [...list, seeAllRow(query)] : list;
  }, [groups, typed, query]);
  const noResults = typed && rows.length === 0;

  // Modal behaviour: focus in, trapped, Escape, scroll lock, focus back to the trigger.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setRecent(readRecent());
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const at = items.indexOf(document.activeElement as HTMLElement);
      const target = trapTarget(items.length, at, event.shiftKey);
      if (target === null) return;
      event.preventDefault();
      items[target]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const optionId = (row: CommandRow) => `${uid}-${row.id}`;
  const activeRow = active === null ? undefined : rows[active];

  const activeId = activeRow ? optionId(activeRow) : undefined;
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function changeQuery(value: string) {
    setQuery(value.slice(0, 200));
    setActive(normaliseCommandQuery(value) ? null : 0);
  }

  function remember(q: string) {
    const next = addRecent(recent, q);
    setRecent(next);
    writeRecent(next);
  }

  function goToResults(q: string) {
    remember(q);
    onClose();
    router.push(seeAllHref(q));
  }

  function run(row: CommandRow) {
    const action = row.action;
    switch (action.kind) {
      case "navigate":
        if (row.id === "see-all") remember(query);
        onClose();
        router.push(action.href);
        break;
      case "search":
        goToResults(action.query);
        break;
      case "submit":
        onClose();
        openSubmit();
        break;
      case "theme":
        applyTheme(action.value);
        onClose();
        break;
      case "clear-recent":
        setRecent([]);
        writeRecent([]);
        setActive(0);
        inputRef.current?.focus();
        break;
    }
  }

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    const { key } = event;
    if (key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End") {
      if (event.altKey || event.shiftKey) return;
      event.preventDefault();
      setActive(moveActive(active, rows.length, key));
    } else if (key === "Enter") {
      event.preventDefault();
      if (activeRow) run(activeRow);
      else if (typed) goToResults(query);
    }
  }

  const countText = noResults
    ? "No results"
    : typed
      ? `${rows.length - 1} ${rows.length - 1 === 1 ? "result" : "results"}`
      : "";

  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-static-black/40" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => {
          // Clicks on the panel's own text must not pull focus out of the input.
          if (!(event.target instanceof HTMLElement && event.target.closest("button, input"))) {
            event.preventDefault();
          }
        }}
        className="absolute inset-x-0 top-0 flex h-dvh flex-col overflow-hidden bg-bg-base md:inset-x-auto md:top-20 md:left-1/2 md:h-auto md:max-h-[min(560px,calc(100dvh-8rem))] md:w-[min(640px,calc(100vw-3rem))] md:-translate-x-1/2 md:rounded-2xl md:border md:border-border-soft md:shadow-e2"
      >
        <h2 id={titleId} className="sr-only">
          Search Matr Studio
        </h2>
        <div className="flex items-center gap-2 border-border-soft border-b px-4 py-3 md:py-3.5">
          <SearchIcon size={20} className="shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-label="Search paths, resources and pages"
            placeholder="Search paths, resources and pages"
            value={query}
            maxLength={200}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={onInputKey}
            className="h-10 min-w-0 flex-1 bg-transparent text-[16px] text-text leading-6 tracking-[-0.16px] outline-none placeholder:text-text-tertiary"
          />
          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className={`flex h-9 shrink-0 items-center justify-center rounded-lg px-2 font-medium text-[14px] text-text-secondary leading-5 tracking-[-0.14px] hover:text-text md:border md:border-border-soft md:bg-bg-fill2 md:px-1.5 md:text-[12px] md:text-text-tertiary md:leading-4 ${FOCUS}`}
          >
            <span className="md:hidden">Cancel</span>
            <span aria-hidden="true" className="hidden md:inline">
              Esc
            </span>
          </button>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {countText}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {noResults ? (
            <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
              <StateArt glyph="search" />
              <div className="flex flex-col gap-1.5">
                <p className="break-words font-medium text-[18px] text-text leading-7 tracking-[-0.18px]">
                  No results for “{normaliseCommandQuery(query)}”
                </p>
                <p className="max-w-[420px] text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
                  We focus on design and development topics. Try another word, or suggest a resource
                  we should add.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    changeQuery("");
                    inputRef.current?.focus();
                  }}
                  className={`${BTN} ${FOCUS}`}
                >
                  Clear search
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openSubmit();
                  }}
                  className={`btn-lift inline-flex h-10 items-center justify-center rounded-lg bg-primary px-3 font-medium text-[14px] text-static-white leading-5 tracking-[-0.14px] ${FOCUS}`}
                >
                  Suggest a resource
                </button>
              </div>
            </div>
          ) : null}
          <div id={listId} role="listbox" aria-label="Results" hidden={noResults}>
            {groups.map((group) => (
              <div key={group.id} {...groupProps({ "aria-labelledby": `${uid}-g-${group.id}` })}>
                <div
                  id={`${uid}-g-${group.id}`}
                  className="px-3 pt-3 pb-1 font-medium text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]"
                >
                  {group.label}
                </div>
                {group.rows.map((row) => {
                  const index = rows.indexOf(row);
                  return (
                    <Option
                      key={row.id}
                      row={row}
                      id={optionId(row)}
                      active={index === active}
                      terms={terms}
                      onHover={() => active !== index && setActive(index)}
                      onPick={() => run(row)}
                    />
                  );
                })}
              </div>
            ))}
            {typed && rows.length > 0 ? (
              <div
                {...groupProps({ "aria-label": "All results" })}
                className="mt-1 border-border-soft border-t pt-1"
              >
                {(() => {
                  const row = rows[rows.length - 1] as CommandRow;
                  const index = rows.length - 1;
                  return (
                    <Option
                      row={row}
                      id={optionId(row)}
                      active={index === active}
                      terms={[]}
                      onHover={() => active !== index && setActive(index)}
                      onPick={() => run(row)}
                    />
                  );
                })()}
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden items-center gap-4 border-border-soft border-t bg-bg-fill1 px-4 py-2.5 text-[12px] text-text-tertiary leading-4 tracking-[-0.12px] md:flex">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            to move
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            {activeRow || !typed ? "to open" : "for all results"}
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
