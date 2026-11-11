"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getCatalogueData, pathHref } from "../../lib/app/paths-catalogue";
import {
  doneCount,
  isCompleted,
  isStarted,
  percent,
  sidebarLine,
} from "../../lib/app/progress-logic";
import { getCatalogue } from "../../lib/catalogue/data";
import { ROUTES } from "../../lib/routes";
import { ArrowRightIcon, CircleCheckIcon, RouteIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { useOptionalPaths } from "../app-progress/progress-provider";
import { TopicIcon } from "../landing/at-work-art";

const MAX_LISTED = 5;

/** The designed empty card of the sidebar's "Your paths" block (nothing started or starred yet). */
function Empty() {
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-border-soft border-dashed bg-bg-fill1 p-3.5">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-accent text-primary-text"
        >
          <RouteIcon size={16} />
        </span>
        <p className="font-semibold text-[14px] text-text leading-5 tracking-[-0.14px]">
          No paths yet
        </p>
      </div>
      <p className="text-[12px] text-text-secondary leading-4 tracking-[-0.12px]">
        Start a path, or star one to save it for later. It’ll show up here.
      </p>
      <Link
        href={ROUTES.app.paths}
        className={`link-slide inline-flex items-center gap-1 self-start rounded-md font-semibold text-[14px] text-primary-text leading-5 tracking-[-0.14px] ${FOCUS}`}
      >
        Browse paths
        <ArrowRightIcon size={14} />
      </Link>
    </div>
  );
}

/** A small ring that fills with progress, or a green check when the path is finished. */
function Ring({ value, complete }: { value: number; complete: boolean }) {
  if (complete) return <CircleCheckIcon size={20} className="shrink-0 text-success-text" />;
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      className="shrink-0 -rotate-90"
    >
      <circle cx="10" cy="10" r={r} fill="none" strokeWidth="2" className="stroke-bg-fill2" />
      {value > 0 ? (
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`}
          className="stroke-primary"
        />
      ) : null}
    </svg>
  );
}

/**
 * "Your paths" (Figma sidebar): the paths the learner started or starred, most recent first, each
 * with its progress line and ring. Without any (or while loading, or if the list cannot load) it
 * keeps the designed empty card. Reads the progress provider when there is one.
 */
export function YourPaths({ onNavigate }: { onNavigate?: () => void }) {
  const paths = useOptionalPaths();
  const entries = paths?.entries;
  const status = paths?.status;
  const listed = useMemo(() => {
    const catalogue = getCatalogueData(getCatalogue()).paths;
    return (entries ?? []).flatMap((entry) => {
      const path = catalogue.find((p) => p.slug === entry.slug);
      return path ? [{ entry, path, all: catalogue }] : [];
    });
  }, [entries]);

  if (status !== "ready" || listed.length === 0) return <Empty />;
  const shown = listed.slice(0, MAX_LISTED);
  return (
    <div className="flex flex-col gap-1">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {shown.map(({ entry, path, all }) => (
          <li key={path.slug}>
            <Link
              href={pathHref(path, all)}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2 hover:bg-bg-fill2 ${FOCUS}`}
            >
              <span aria-hidden="true" className="shrink-0 text-text-secondary">
                <TopicIcon topic={path.topicSlug} size={22} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
                  {path.title}
                </span>
                <span className="text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
                  {sidebarLine(entry, path.lessons)}
                </span>
              </span>
              {isStarted(entry) || isCompleted(entry) ? (
                <Ring
                  value={percent(doneCount(entry, path.lessons), path.lessons)}
                  complete={isCompleted(entry)}
                />
              ) : (
                <Ring value={0} complete={false} />
              )}
            </Link>
          </li>
        ))}
      </ul>
      {listed.length > shown.length ? (
        <Link
          href={ROUTES.app.paths}
          onClick={onNavigate}
          className={`link-slide self-start rounded-md px-3.5 py-1 font-semibold text-[13px] text-primary-text leading-5 ${FOCUS}`}
        >
          See all {listed.length} paths
        </Link>
      ) : null}
    </div>
  );
}
