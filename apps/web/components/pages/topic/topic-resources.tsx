import type { ResourceFormat } from "../../../lib/catalogue/types";
import { BookmarkIcon, ExternalLinkIcon, ResourceThumb } from "./topic-art";
import type { ResourceCardView, TopicPageView } from "./topic-view";

const FORMAT_LABEL: Record<ResourceFormat, string> = {
  video: "Video",
  article: "Article",
  docs: "Docs",
  tool: "Tool",
};

/** Type badge colours (Figma: video rose, article blue, tool green; docs takes amber). */
const FORMAT_BADGE: Record<ResourceFormat, { box: string; dot: string }> = {
  video: { box: "bg-error-focus text-error-text", dot: "bg-error-text" },
  article: { box: "bg-info-focus text-utility-blue", dot: "bg-utility-blue" },
  docs: { box: "bg-warning-focus text-warning-text", dot: "bg-warning-text" },
  tool: { box: "bg-success-focus text-success-text", dot: "bg-success-text" },
};

function ResourceCard({ resource }: { resource: ResourceCardView }) {
  const badge = FORMAT_BADGE[resource.format];
  return (
    <article className="card-lift flex flex-col overflow-clip rounded-2xl border border-border-soft bg-bg-base">
      <ResourceThumb video={resource.format === "video"}>
        <span className="absolute top-2.5 left-2.5 rounded-full bg-bg-base px-3 py-1.5 font-medium text-[12px] text-text leading-4 tracking-[-0.12px]">
          {resource.source}
        </span>
        <span className="absolute right-2 bottom-2.5 rounded-md bg-ink/85 px-2 py-1 font-medium text-[12px] text-bg-base leading-4 tracking-[-0.12px]">
          {resource.length}
        </span>
      </ResourceThumb>
      <div className="flex flex-col gap-1.5 px-4 py-3.5">
        <h3 className="truncate font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
          {resource.title}
        </h3>
        <p className="font-medium text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          {resource.meta}
        </p>
        <div className="flex items-center justify-between pt-1.5">
          <span
            className={`flex items-center gap-0.5 rounded-md px-1.5 py-[3px] font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${badge.box}`}
          >
            <span className="flex items-center justify-center p-[3px]">
              <span className={`size-1.5 rounded-full ${badge.dot}`} />
            </span>
            <span className="px-0.5">{FORMAT_LABEL[resource.format]}</span>
          </span>
          <span className="flex items-start gap-0.5 text-text-secondary">
            <span aria-hidden="true" className="p-[7px]">
              <BookmarkIcon />
            </span>
            {resource.url ? (
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${resource.title} on ${resource.source}`}
                className="rounded-md p-[7px] transition-colors hover:text-text"
              >
                <ExternalLinkIcon />
              </a>
            ) : (
              <span aria-hidden="true" className="p-[7px]">
                <ExternalLinkIcon />
              </span>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}

/** Figma Sample lessons (780:16790): the topic's resources in the library. Hidden when there are none. */
export function TopicResources({ view }: { view: TopicPageView }) {
  if (view.resources.length === 0) return null;
  return (
    <section
      aria-labelledby="topic-resources-heading"
      className="border-border-soft border-t px-5 lg:px-8"
    >
      <div className="mx-auto flex max-w-[1240px] flex-col gap-10 border-border-soft border-r border-l px-4 py-14 md:px-10 md:py-24">
        <h2
          id="topic-resources-heading"
          className="font-medium text-[32px] text-text leading-[38px] tracking-[-0.96px] md:text-[44px] md:leading-[50px] md:tracking-[-0.88px]"
        >
          {view.content.resourcesHeading}
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
          {view.resources.map((resource) => (
            <li
              key={`${resource.source}-${resource.title}`}
              className="flex flex-col [&>article]:flex-1"
            >
              <ResourceCard resource={resource} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
