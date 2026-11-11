"use client";

import { useCallback, useRef, useState } from "react";
import { nextOpenState, type OpenState, openMode } from "../../lib/app/detail-state";
import { type LibraryItem, safeResourceUrl } from "../../lib/app/library-data";
import { useMediaQuery } from "../app/hooks";
import { FOCUS } from "../app/ui";
import { ExternalIcon, KIND_ICON, PlayIcon, ThumbArt } from "./art";
import { ReadingWindow } from "./reading-window";
import { SourcePill } from "./resource-card";
import { BTN_DISABLED, BTN_SECONDARY } from "./ui";

const TINTED = `btn-lift inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary-focus px-3 font-medium text-[14px] text-primary-text leading-5 tracking-[-0.14px] ${FOCUS}`;
const NOTICE =
  "flex items-center gap-2 rounded-lg bg-primary-focus px-3 py-2.5 text-[14px] text-primary-text leading-5 tracking-[-0.14px]";

function WindowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
    </svg>
  );
}

/** Video: the large media block. It links to the original video when there is a real URL. */
export function VideoBlock({ item }: { item: LibraryItem }) {
  const url = safeResourceUrl(item.url);
  const inner = (
    <>
      <ThumbArt kind="video" className="aspect-video" />
      <span className="absolute top-3 left-3">
        <SourcePill slug={item.sourceSlug} name={item.sourceName} />
      </span>
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-bg-base text-text shadow-e2"
      >
        <PlayIcon size={26} />
      </span>
      <span className="absolute right-3 bottom-3 rounded-md bg-static-black/85 px-2 py-1 font-medium text-[12px] text-static-white leading-4 tracking-[-0.12px]">
        {item.lengthLabel}
      </span>
    </>
  );
  const frame = "relative block overflow-clip rounded-2xl border border-border-soft";
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`${frame} ${FOCUS}`}>
      {inner}
      <span className="sr-only">
        Play {item.title} on {item.sourceName} (opens in a new tab)
      </span>
    </a>
  ) : (
    <div className={frame}>{inner}</div>
  );
}

/**
 * Article and tool: the source card (Figma "Resource: article" and "Resource: tool"). Articles get
 * the primary "Open reading window" on tablet and desktop (an overlay, ReadingWindow) and "Open
 * article" on phones, where the article opens in a new tab and the card then says so. Tools just
 * open in a new tab. Sample content has no URL, so every open action is disabled with the reason.
 */
export function SourceCard({ item }: { item: LibraryItem }) {
  const url = safeResourceUrl(item.url);
  const wide = useMediaQuery("(min-width: 768px)");
  const [state, setState] = useState<OpenState>("idle");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const KindIcon = KIND_ICON[item.kind];
  const isArticle = item.kind === "article";
  const mode = openMode(item.kind, wide);

  const closeWindow = useCallback(() => setState((s) => nextOpenState(s, "close-window")), []);
  const openTab = useCallback(() => setState((s) => nextOpenState(s, "open-tab")), []);

  function openArticle() {
    if (!url) return;
    if (mode === "window") {
      setState((s) => nextOpenState(s, "open-window"));
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
      openTab();
    }
  }

  const notice =
    state === "window"
      ? "Reading in a separate window. Close it to come back here."
      : state === "tab"
        ? "Opened in a new tab. Come back here when you’re done."
        : null;
  const primaryLabel = isArticle
    ? mode === "window"
      ? "Open reading window"
      : state === "tab"
        ? "Open article again"
        : "Open article"
    : "Open tool";

  return (
    <section
      aria-label="Source"
      className="flex flex-col gap-4 rounded-2xl border border-border-soft p-5"
    >
      <p role="status" className={notice ? NOTICE : "hidden"}>
        {notice ? (
          <>
            <WindowIcon size={18} />
            {notice}
          </>
        ) : null}
      </p>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-bg-fill1 text-text-secondary">
          <KindIcon size={18} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
            {item.sourceName}
          </span>
          <span className="text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
            {isArticle ? "Article" : "Tool"} · {item.lengthLabel}
          </span>
        </div>
      </div>
      <p className="break-words font-semibold text-[20px] text-text leading-7 tracking-[-0.2px]">
        {item.title}
      </p>
      {url ? (
        <div className="flex flex-wrap items-center gap-2">
          {isArticle ? (
            <button ref={triggerRef} type="button" onClick={openArticle} className={TINTED}>
              <WindowIcon />
              {primaryLabel}
            </button>
          ) : null}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openTab}
            className={isArticle ? BTN_SECONDARY : TINTED}
          >
            <ExternalIcon size={16} />
            {isArticle ? "Open in new tab" : primaryLabel}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled
              title="Sample content has no link"
              className={BTN_DISABLED}
            >
              <ExternalIcon size={16} />
              {primaryLabel}
            </button>
          </div>
          <p className="text-[13px] text-text-tertiary leading-[18px] tracking-[-0.13px]">
            This is sample content, so there is no link to open yet.
          </p>
        </>
      )}
      {state === "window" && url ? (
        <ReadingWindow
          item={item}
          url={url}
          returnFocusTo={triggerRef}
          onClose={closeWindow}
          onOpenTab={openTab}
        />
      ) : null}
    </section>
  );
}
