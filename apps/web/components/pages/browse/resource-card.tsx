"use client";

import { useState } from "react";
import {
  type BrowseResource,
  filterOf,
  LEVEL_TEXT,
  TYPE_LABEL,
} from "../../../lib/pages/browse-library";

/**
 * Resource Card (Figma Library 780:13055): thumbnail with source pill and length badge, title,
 * "Topic · Level", type badge and the save / open actions. Save is local state for now.
 */
const SOURCE_LOGO: Record<string, { src: string; mono: boolean }> = {
  youtube: { src: "/images/sources/youtube.svg", mono: false },
  medium: { src: "/images/sources/medium.svg", mono: true },
  figma: { src: "/images/sources/figma.svg", mono: false },
};

const TYPE_STYLE = {
  video: {
    badge:
      "bg-[color-mix(in_srgb,var(--matr-fuchsia)_16%,var(--matr-bg-base))] text-utility-fuchsia",
    dot: "bg-utility-fuchsia",
  },
  article: {
    badge: "bg-[color-mix(in_srgb,var(--matr-blue)_16%,var(--matr-bg-base))] text-utility-blue",
    dot: "bg-utility-blue",
  },
  tool: {
    badge:
      "bg-[color-mix(in_srgb,var(--matr-emerald)_16%,var(--matr-bg-base))] text-utility-emerald",
    dot: "bg-utility-emerald",
  },
} as const;

const icon = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
} as const;

function Thumb({ format }: { format: BrowseResource["format"] }) {
  const video = format === "video";
  return (
    <div
      aria-hidden="true"
      className="relative h-[180px] w-full overflow-clip bg-[color-mix(in_srgb,var(--matr-blue)_14%,var(--matr-bg-base))]"
    >
      <div className="absolute inset-[22.22%_-25%_-50%_53.13%] rounded-full bg-[color-mix(in_srgb,var(--matr-blue)_26%,var(--matr-bg-base))]" />
      <div className="absolute inset-[-27.78%_71.88%_55.56%_-12.5%] rounded-full bg-[color-mix(in_srgb,var(--matr-blue)_22%,var(--matr-bg-base))]" />
      <div className="absolute inset-[49.82%_54.43%_-6.39%_13.75%] -rotate-14 rounded-[20px] bg-[color-mix(in_srgb,var(--matr-blue)_55%,var(--matr-bg-base))]" />
      <div className="absolute top-[14.44%] left-[66.25%] size-3.5 rounded-full bg-utility-blue" />
      {video ? <div className="absolute inset-0 bg-static-black opacity-35" /> : null}
      <div className="absolute top-1/2 left-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl bg-bg-base text-text shadow-e2">
        <svg aria-hidden="true" {...icon} className="size-5">
          {video ? (
            <path d="M7 4.5v15l12-7.5Z" fill="currentColor" />
          ) : format === "tool" ? (
            <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4Z" />
          ) : (
            <>
              <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z" />
              <path d="M14 3v5h5M9 13h6M9 17h6" />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

export function ResourceCard({
  resource,
  saved: savedProp,
  onSaveChange,
}: {
  resource: BrowseResource;
  /** Controlled saved state (the /saved page); uncontrolled when omitted. */
  saved?: boolean;
  onSaveChange?: (saved: boolean) => void;
}) {
  const [local, setLocal] = useState(false);
  const saved = savedProp ?? local;
  const kind = filterOf(resource.format);
  const style = TYPE_STYLE[kind];
  const logo = SOURCE_LOGO[resource.sourceSlug];
  const meta = [resource.topicName, resource.level ? LEVEL_TEXT[resource.level] : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="card-lift flex flex-col overflow-clip rounded-2xl border border-border-soft bg-bg-base">
      <div className="relative">
        <Thumb format={resource.format} />
        <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-bg-base py-1.5 pr-3 pl-2 font-medium text-[12px] text-text leading-4 tracking-[-0.12px]">
          {logo ? (
            <img
              src={logo.src}
              alt=""
              width={16}
              height={16}
              className={`size-4 ${logo.mono ? "invert dark:invert-0" : ""}`}
            />
          ) : null}
          {resource.sourceName}
        </span>
        <span className="absolute right-2 bottom-2.5 rounded-md bg-static-black/85 px-2 py-1 font-medium text-[12px] text-static-white leading-4 tracking-[-0.12px]">
          {resource.lengthLabel}
        </span>
      </div>
      <div className="flex flex-col items-start gap-1.5 px-4 py-3.5">
        <h3 className="w-full truncate font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
          {resource.title}
        </h3>
        {meta ? (
          <p className="font-medium text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
            {meta}
          </p>
        ) : null}
        <div className="flex w-full items-center justify-between pt-1.5">
          <span
            className={`flex items-center gap-0.5 rounded-md py-[3px] pr-1.5 pl-1.5 font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${style.badge}`}
          >
            <span aria-hidden="true" className={`m-[3px] size-1.5 rounded-full ${style.dot}`} />
            <span className="px-0.5">{TYPE_LABEL[kind]}</span>
          </span>
          <span className="flex items-start gap-0.5 text-text-secondary">
            <button
              type="button"
              aria-pressed={saved}
              aria-label={`${saved ? "Remove" : "Save"} ${resource.title}`}
              onClick={() => {
                setLocal(!saved);
                onSaveChange?.(!saved);
              }}
              className={`flex items-center justify-center rounded-md p-[7px] hover:bg-bg-fill1 ${
                saved ? "text-primary-text" : ""
              }`}
            >
              <svg
                aria-hidden="true"
                {...icon}
                className="size-[18px]"
                fill={saved ? "currentColor" : "none"}
              >
                <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
              </svg>
            </button>
            {resource.url ? (
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${resource.title} on ${resource.sourceName}`}
                className="flex items-center justify-center rounded-md p-[7px] hover:bg-bg-fill1"
              >
                <svg aria-hidden="true" {...icon} className="size-[18px]">
                  <path d="M15 3h6v6M10 14 21 3M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
                </svg>
              </a>
            ) : (
              <span
                aria-hidden="true"
                className="flex items-center justify-center rounded-md p-[7px] opacity-50"
              >
                <svg aria-hidden="true" {...icon} className="size-[18px]">
                  <path d="M15 3h6v6M10 14 21 3M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
                </svg>
              </span>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}
