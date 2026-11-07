import type { Source } from "../../lib/catalogue/types";

/**
 * Figma "Product landing page · V3": Sources 740:34637. Shows the first six catalogue sources (the
 * design's strip). `mono` logos are exported near-white for the dark frame, so light mode inverts
 * them to near-black.
 */
const LOGOS: Record<string, { src: string; mono: boolean }> = {
  youtube: { src: "/images/sources/youtube.svg", mono: false },
  medium: { src: "/images/sources/medium.svg", mono: true },
  figma: { src: "/images/sources/figma.svg", mono: false },
  "smashing-magazine": { src: "/images/sources/smashing-magazine.svg", mono: false },
  mdn: { src: "/images/sources/mdn.svg", mono: true },
  freecodecamp: { src: "/images/sources/freecodecamp.svg", mono: true },
};

function Logo({ slug }: { slug: string }) {
  const logo = LOGOS[slug];
  if (!logo) return null;
  return (
    <img
      src={logo.src}
      alt=""
      width={24}
      height={24}
      className={`size-6 shrink-0 ${logo.mono ? "invert dark:invert-0" : ""}`}
    />
  );
}

export function Sources({ sources }: { sources: Source[] }) {
  const shown = sources.filter((source) => LOGOS[source.slug]).slice(0, 6);
  return (
    <section
      id="sources"
      aria-label="Where the lessons come from"
      className="border-border-soft border-b px-5 lg:px-8"
    >
      <div className="mx-auto max-w-[1240px] overflow-clip border-border-soft border-r border-l">
        <ul className="-mr-px -mb-px grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {shown.map((source) => (
            <li
              key={source.slug}
              className="flex h-[88px] items-center justify-center gap-2.5 border-border-soft border-r border-b px-2 md:h-[120px]"
            >
              <Logo slug={source.slug} />
              <span className="font-medium md:whitespace-nowrap text-[16px] text-text leading-6 tracking-[-0.16px]">
                {source.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
