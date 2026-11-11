import Link from "next/link";
import { type LibraryItem, safeResourceUrl } from "../../lib/app/library-data";
import { LEVEL_TEXT } from "../../lib/pages/browse-library";
import { ROUTES } from "../../lib/routes";
import { BookmarkButton } from "../app-saved/bookmark-button";
import { ExternalIcon, ThumbArt, TypeBadge } from "./art";

const SOURCE_LOGO: Record<string, { src: string; mono: boolean }> = {
  youtube: { src: "/images/sources/youtube.svg", mono: false },
  medium: { src: "/images/sources/medium.svg", mono: true },
  figma: { src: "/images/sources/figma.svg", mono: false },
};

export function SourcePill({ slug, name }: { slug: string; name: string }) {
  const logo = SOURCE_LOGO[slug];
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-bg-base py-1.5 pr-3 pl-2 font-medium text-[12px] text-text leading-4 tracking-[-0.12px]">
      {logo ? (
        <img
          src={logo.src}
          alt=""
          width={16}
          height={16}
          className={`size-4 ${logo.mono ? "invert dark:invert-0" : ""}`}
        />
      ) : null}
      {name}
    </span>
  );
}

/**
 * Resource card (Figma "Resource Card": thumbnail with source pill and length badge, title,
 * "Topic · Level", type badge). The whole card opens the in-app resource page (stretched title
 * link); the small arrow opens the original source in a new tab when there is a real URL.
 *
 * The bookmark beside the arrow saves the resource to the learner's Saved list (app-saved/).
 */
export function LibraryCard({ item }: { item: LibraryItem }) {
  const url = safeResourceUrl(item.url);
  const meta = [item.topicName, item.level ? LEVEL_TEXT[item.level] : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <article className="card-lift relative flex h-full flex-col overflow-clip rounded-2xl border border-border-soft bg-bg-base">
      <div className="relative">
        <ThumbArt kind={item.kind} />
        <span className="absolute top-2.5 left-2.5">
          <SourcePill slug={item.sourceSlug} name={item.sourceName} />
        </span>
        <span className="absolute right-2 bottom-2.5 rounded-md bg-static-black/85 px-2 py-1 font-medium text-[12px] text-static-white leading-4 tracking-[-0.12px]">
          {item.lengthLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col items-start gap-1.5 px-4 py-3.5">
        <h3 className="w-full truncate font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
          <Link
            href={`${ROUTES.app.library}/${item.id}`}
            className="rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-primary-border focus-visible:outline-offset-[-2px]"
          >
            {item.title}
          </Link>
        </h3>
        {meta ? (
          <p className="font-medium text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
            {meta}
          </p>
        ) : null}
        <div className="mt-auto flex w-full items-center justify-between pt-1.5">
          <TypeBadge kind={item.kind} />
          <div className="flex items-center">
            <BookmarkButton id={item.id} title={item.title} />
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${item.title} on ${item.sourceName} (new tab)`}
                className="relative z-10 flex items-center justify-center rounded-md p-[7px] text-text-secondary hover:bg-bg-fill1 hover:text-text focus-visible:outline-2 focus-visible:outline-primary-border"
              >
                <ExternalIcon size={18} />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
