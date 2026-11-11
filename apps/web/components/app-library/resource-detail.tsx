import Link from "next/link";
import { aboutText } from "../../lib/app/detail-state";
import {
  eyebrow,
  type LibraryItem,
  pathsUsing,
  relatedItems,
  safeResourceUrl,
} from "../../lib/app/library-data";
import { getCatalogue } from "../../lib/catalogue/data";
import { LEVEL_TEXT } from "../../lib/pages/browse-library";
import { ROUTES } from "../../lib/routes";
import { FOCUS } from "../app/ui";
import { SaveButton } from "../app-saved/save-button";
import { ClockIcon } from "../landing/at-work-art";
import { ExternalIcon, KIND_ICON, SampleTag } from "./art";
import { SourceCard, VideoBlock } from "./detail-source";
import { ReportLink } from "./report-link";
import { LibraryCard } from "./resource-card";
import { BackLink, BTN_DISABLED, BTN_SECONDARY, H1 } from "./ui";

const SECTION = "flex flex-col gap-3 rounded-2xl border border-border-soft p-4";
const H2 = "font-medium text-[14px] text-text leading-5 tracking-[-0.14px]";

/**
 * /learn/library/[id] (Figma "Video / Article / Tool resource", Desktop, Tablet, Phone). One column
 * below xl, content plus a 340px side column from xl. A video shows the large media block; articles
 * and tools show a source card whose actions live in detail-source.tsx (reading window on
 * tablet/desktop, new tab on phones). The "About this resource" panel is one factual line built
 * from the catalogue (the data has no description or "why it's here" text, so none is invented).
 * "Used in these paths" lists real published paths only and is hidden when there are none.
 *
 * Save (app-saved/save-button.tsx) leads the actions row.
 * "Report a broken link" opens a prefilled email (see report-link.tsx).
 */
export function ResourceDetail({ item, all }: { item: LibraryItem; all: LibraryItem[] }) {
  const url = safeResourceUrl(item.url);
  const paths = pathsUsing(getCatalogue(), item.id);
  const related = relatedItems(item, all, 2);
  const KindIcon = KIND_ICON[item.kind];
  const isVideo = item.kind === "video";

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      <BackLink href={ROUTES.app.library}>Library</BackLink>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <article className="flex min-w-0 flex-col gap-5">
          <header className="flex flex-col gap-2">
            <p className="font-mono text-[12px] text-text-tertiary leading-4 tracking-[0.72px]">
              {eyebrow(item, (level) => LEVEL_TEXT[level])}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className={`${H1} break-words`}>{item.title}</h1>
              {item.sample ? <SampleTag /> : null}
            </div>
            <p className="flex items-center gap-1.5 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              <KindIcon size={16} />
              {item.sourceName} · {item.lengthLabel}
            </p>
          </header>

          {isVideo ? <VideoBlock item={item} /> : <SourceCard item={item} />}

          <section
            aria-labelledby="about-resource"
            className="flex flex-col gap-2 rounded-2xl bg-bg-fill1 p-4"
          >
            <h2 id="about-resource" className={H2}>
              About this resource
            </h2>
            <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              {aboutText(item, (level) => LEVEL_TEXT[level])}
            </p>
          </section>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <SaveButton id={item.id} title={item.title} />
              {isVideo && url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${BTN_SECONDARY} w-full md:w-auto`}
                >
                  <ExternalIcon size={16} />
                  Open on {item.sourceName}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
              {isVideo && !url ? (
                <button
                  type="button"
                  disabled
                  title="Sample content has no link"
                  className={`${BTN_DISABLED} w-full md:w-auto`}
                >
                  <ExternalIcon size={16} />
                  Open on {item.sourceName}
                </button>
              ) : null}
            </div>
            <ReportLink item={item} />
          </div>
          {isVideo && !url ? (
            <p className="text-[13px] text-text-tertiary leading-[18px] tracking-[-0.13px]">
              This is sample content, so there is no link to open yet.
            </p>
          ) : null}
        </article>

        <aside className="flex min-w-0 flex-col gap-4">
          {paths.length > 0 ? (
            <section aria-labelledby="used-in-paths" className={SECTION}>
              <h2 id="used-in-paths" className={H2}>
                Used in these paths
              </h2>
              <p className="text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
                Follow a path to get this as a lesson, with progress tracked.
              </p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {paths.map((path) => (
                  <li key={path.slug}>
                    <Link
                      href={ROUTES.app.pathTopic(path.topicSlug)}
                      className={`flex flex-col rounded-lg border border-border-soft p-3 hover:bg-bg-fill1 ${FOCUS}`}
                    >
                      <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
                        {path.title}
                      </span>
                      <span className="flex items-center gap-1 text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
                        <ClockIcon />
                        Lesson {path.lesson} of {path.lessons}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {related.length > 0 ? (
            <section aria-labelledby="more-like-this" className={SECTION}>
              <h2 id="more-like-this" className={H2}>
                More like this
              </h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {related.map((other) => (
                  <li key={other.id}>
                    <LibraryCard item={other} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
