"use client";

import Link from "next/link";
import { type ReactNode, useId, useMemo, useRef, useState } from "react";
import { getCatalogueData, pathHref, plural } from "../../lib/app/paths-catalogue";
import type { PathDetailView } from "../../lib/app/paths-detail";
import { firstName } from "../../lib/app/profile";
import { finishedIn } from "../../lib/app/progress-logic";
import {
  copyLink,
  displayUrl,
  keepGoing,
  linkedInUrl,
  shareOrCopy,
  shareUrl,
} from "../../lib/app/progress-share";
import type { PathProgress } from "../../lib/auth/progress-api";
import { getCatalogue } from "../../lib/catalogue/data";
import { useModalSurface } from "../app/hooks";
import { CloseIcon, ShareIcon } from "../app/icons";
import { useSession } from "../app/session";
import { FOCUS } from "../app/ui";
import { usePaths } from "../app-progress/progress-provider";
import { BookIcon, ClockIcon } from "../landing/at-work-art";
import { ArrowLeftIcon, ExternalLinkIcon } from "./icons";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, LargeCover } from "./parts";

const CLOSE_BTN = `flex size-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-fill1 hover:text-text ${FOCUS}`;

/** Dimmed page, then a centred card on tablet and desktop and a bottom sheet on phones. */
function Surface({
  labelledBy,
  onClose,
  children,
  hero,
}: {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  hero?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useModalSurface(panel, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-static-black/50" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-bg-base shadow-e2 md:max-w-[420px] md:rounded-3xl"
      >
        {hero}
        <div className="flex min-h-0 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="hidden size-9 shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary min-[420px]:flex"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="whitespace-nowrap text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          {label}
        </span>
        <span className="whitespace-nowrap font-semibold text-[14px] text-text leading-5 tracking-[-0.14px]">
          {value}
        </span>
      </div>
    </div>
  );
}

/** A small rocket on the orange hero (Figma "Finish: path complete"). Decorative. */
function Rocket() {
  return (
    <svg
      width="64"
      height="96"
      viewBox="0 0 64 96"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M32 4c10 10 14 26 14 44v14H18V48C18 30 22 14 32 4Z" fill="var(--matr-bg-base)" />
      <circle cx="32" cy="34" r="7" fill="var(--matr-bg-fill2)" />
      <path d="M18 50 6 66v10l12-8Zm28 0 12 16v10l-12-8Z" fill="var(--matr-bg-fill2)" />
      <path d="M26 66h12l-6 26Z" fill="var(--matr-bg-fill2)" opacity=".7" />
    </svg>
  );
}

/**
 * "Path complete" (Figma "Finish: path complete"): a dialog over the last lesson with what you did
 * and where to go next. The design also asks "How was this path?" with a star rating; there is no
 * rating API, so it is left out rather than shown doing nothing.
 */
export function CompleteDialog({
  view,
  entry,
  onBack,
  onClose,
}: {
  view: PathDetailView;
  entry: PathProgress;
  /** "Back to path": the caller navigates to the path page. */
  onBack: () => void;
  onClose: () => void;
}) {
  const { me } = useSession();
  const { entries } = usePaths();
  const [sharing, setSharing] = useState(false);
  const titleId = useId();
  const { path } = view;
  const name = firstName(me.name);
  const took = finishedIn(entry);
  const picks = useMemo(
    () => keepGoing(getCatalogueData(getCatalogue()).paths, entries, path),
    [entries, path],
  );
  if (sharing)
    return <ShareDialog view={view} onBack={() => setSharing(false)} onClose={onClose} />;
  return (
    <Surface
      labelledBy={titleId}
      onClose={onClose}
      hero={
        <div className="relative flex h-[148px] shrink-0 items-start justify-center bg-primary pt-6 md:h-[170px]">
          <Rocket />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`absolute top-3 right-3 bg-bg-base text-text ${CLOSE_BTN} hover:bg-bg-base`}
          >
            <CloseIcon size={18} />
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-5 px-5 pt-4 pb-5 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-focus px-2.5 py-1 font-medium text-[13px] text-success-text leading-[18px]">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success-text" />
          Path completed
        </span>
        <div className="flex flex-col gap-2">
          <h2
            id={titleId}
            className="font-semibold text-[24px] text-text leading-8 tracking-[-0.24px]"
          >
            You finished {path.title}
          </h2>
          <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
            {path.lessons} {plural(path.lessons, "lesson", "lessons")} done. That’s a real step
            forward{name ? `, ${name}` : ""}.
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 rounded-xl bg-bg-fill1 p-3 text-left sm:grid-cols-3">
          <Stat icon={<BookIcon />} label="Lessons" value={`${path.lessons} of ${path.lessons}`} />
          <Stat
            icon={<ClockIcon />}
            label="Time"
            value={path.hours > 0 ? `About ${path.hours} hrs` : "Not yet known"}
          />
          {took ? <Stat icon={<ClockIcon />} label="Finished in" value={took} /> : null}
        </div>
        {picks.length > 0 ? (
          <div className="flex w-full flex-col gap-2.5 border-border-soft border-t pt-4 text-left">
            <h3 className="font-semibold text-[14px] text-text leading-5 tracking-[-0.14px]">
              Keep going
            </h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {picks.map((pick) => (
                <li key={pick.slug}>
                  <Link
                    href={pathHref(pick, getCatalogueData(getCatalogue()).paths)}
                    className={`flex flex-col rounded-xl border border-border-soft px-3.5 py-2.5 hover:bg-bg-fill1 ${FOCUS}`}
                  >
                    <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
                      {pick.title}
                    </span>
                    <span className="text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
                      {pick.lessons} {plural(pick.lessons, "lesson", "lessons")} · {pick.hours} hrs
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="grid w-full grid-cols-2 gap-2.5">
          <button type="button" onClick={onBack} className={`${BUTTON_SECONDARY} h-10`}>
            Back to path
          </button>
          <button
            type="button"
            onClick={() => setSharing(true)}
            className={`${BUTTON_PRIMARY} h-10`}
          >
            <ShareIcon size={16} />
            Share achievement
          </button>
        </div>
      </div>
    </Surface>
  );
}

type Notice = "copied" | "failed" | null;

/**
 * "Share your achievement" (Figma "Finish: share achievement"). There is no hosted achievement page
 * or picture, so the card is drawn here and the link is the path's public page. "More options"
 * opens the system share sheet when the browser has one and only shows then; Copy link always works.
 */
export function ShareDialog({
  view,
  onBack,
  onClose,
}: {
  view: PathDetailView;
  /** Back to the completion card; omitted when opened from the path page. */
  onBack?: () => void;
  onClose: () => void;
}) {
  const { me } = useSession();
  const [notice, setNotice] = useState<Notice>(null);
  const titleId = useId();
  const { path } = view;
  const url = shareUrl(path);
  const name = firstName(me.name);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    const result = await copyLink(url, navigator.clipboard ?? {});
    setNotice(result === "copied" ? "copied" : "failed");
  }
  async function more() {
    const result = await shareOrCopy(path, url, {
      share: navigator.share?.bind(navigator),
      writeText: navigator.clipboard?.writeText.bind(navigator.clipboard),
    });
    if (result === "copied") setNotice("copied");
    else if (result === "failed") setNotice("failed");
  }

  return (
    <Surface labelledBy={titleId} onClose={onClose}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2">
          {onBack ? (
            <button type="button" aria-label="Back" onClick={onBack} className={CLOSE_BTN}>
              <ArrowLeftIcon size={18} />
            </button>
          ) : null}
          <h2
            id={titleId}
            className="min-w-0 flex-1 font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]"
          >
            Share your achievement
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className={CLOSE_BTN}>
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-border-soft">
          <LargeCover topic={path.topicSlug} />
          <div className="flex flex-col items-start gap-2 p-3.5">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-success-focus px-1.5 py-[3px] font-medium text-[13px] text-success-text leading-[18px]">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success-text" />
              Completed
            </span>
            <p className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
              {path.title}
            </p>
            <p className="text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
              {name ? `Completed by ${name} · ` : "Completed · "}
              {path.lessons} {plural(path.lessons, "lesson", "lessons")} · matrstudio.com
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-bg-fill1 py-1.5 pr-1.5 pl-3">
          <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
            {displayUrl(url)}
          </span>
          <button type="button" onClick={copy} className={`${BUTTON_SECONDARY} h-8 shrink-0`}>
            Copy link
          </button>
        </div>
        <p role="status" className="min-h-4 text-[12px] text-text-secondary leading-4">
          {notice === "copied"
            ? "Link copied."
            : notice === "failed"
              ? "Couldn’t copy the link. Select it and copy it yourself."
              : ""}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <a
            href={linkedInUrl(url)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${BUTTON_SECONDARY} h-10 ${canShare ? "" : "col-span-2"}`}
          >
            Share on LinkedIn
            <ExternalLinkIcon size={14} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          {canShare ? (
            <button type="button" onClick={more} className={`${BUTTON_SECONDARY} h-10`}>
              <ShareIcon size={16} />
              More options
            </button>
          ) : null}
        </div>
        <button type="button" onClick={onClose} className={`${BUTTON_PRIMARY} h-11 w-full`}>
          Done
        </button>
      </div>
    </Surface>
  );
}
