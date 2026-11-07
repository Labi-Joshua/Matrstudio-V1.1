import Link from "next/link";
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
import { BookmarkIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { ClockIcon } from "../landing/at-work-art";
import { ExternalIcon, KIND_ICON, SampleTag, ThumbArt } from "./art";
import { LibraryCard, SourcePill } from "./resource-card";
import { BackLink, BTN_DISABLED, BTN_PRIMARY, BTN_SECONDARY, H1 } from "./ui";

const SECTION = "flex flex-col gap-3 rounded-2xl border border-border-soft p-4";
const H2 = "font-medium text-[14px] text-text leading-5 tracking-[-0.14px]";

/**
 * /learn/library/[id] (Figma "Video / Article / Tool resource"). A video shows the large media
 * block; articles and tools show a source card. Facts come only from the catalogue: there is no
 * description or "why it's here" text in the data yet, so the "About this resource" panel is not
 * built. "Used in these paths" lists real published paths only and is hidden when there are none.
 *
 * Save is shown disabled ("Coming soon", no saved-items API) and there is no "Report a broken
 * link" (no API). "Open" opens the original source in a new tab only when the resource has an
 * https URL; sample resources have none, so it is disabled with a reason.
 */
export function ResourceDetail({ item, all }: { item: LibraryItem; all: LibraryItem[] }) {
  const url = safeResourceUrl(item.url);
  const paths = pathsUsing(getCatalogue(), item.id);
  const related = relatedItems(item, all, 2);
  const KindIcon = KIND_ICON[item.kind];
  const openLabel = item.kind === "tool" ? "Open tool" : `Open on ${item.sourceName}`;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <BackLink href={ROUTES.app.library}>Library</BackLink>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
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

          {item.kind === "video" ? (
            <div className="relative overflow-clip rounded-2xl border border-border-soft">
              <ThumbArt kind="video" className="aspect-video" />
              <span className="absolute top-3 left-3">
                <SourcePill slug={item.sourceSlug} name={item.sourceName} />
              </span>
              <span className="absolute right-3 bottom-3 rounded-md bg-static-black/85 px-2 py-1 font-medium text-[12px] text-static-white leading-4 tracking-[-0.12px]">
                {item.lengthLabel}
              </span>
            </div>
          ) : (
            <section
              aria-label="Source"
              className="flex flex-col gap-2 rounded-2xl border border-border-soft p-5"
            >
              <p className="flex items-center gap-2 font-medium text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
                <span className="flex size-8 items-center justify-center rounded-lg border border-border-soft bg-bg-fill1 text-text-secondary">
                  <KindIcon size={16} />
                </span>
                {item.sourceName}
                <span className="text-text-tertiary">· {item.lengthLabel}</span>
              </p>
              <p className="font-semibold text-[18px] text-text leading-7 tracking-[-0.18px]">
                {item.title}
              </p>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled
              title="Coming soon"
              aria-label="Save (coming soon)"
              className={BTN_DISABLED}
            >
              <BookmarkIcon size={16} />
              Save
            </button>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={item.kind === "tool" ? BTN_PRIMARY : BTN_SECONDARY}
              >
                <ExternalIcon size={16} />
                {openLabel}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="Sample content has no link"
                className={BTN_DISABLED}
              >
                <ExternalIcon size={16} />
                {openLabel}
              </button>
            )}
          </div>
          {url ? null : (
            <p className="text-[13px] text-text-tertiary leading-[18px] tracking-[-0.13px]">
              This is sample content, so there is no link to open yet.
            </p>
          )}
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
