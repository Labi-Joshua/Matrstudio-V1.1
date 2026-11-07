import { CHIP_ICONS, CLOUD_LINES } from "./tag-cloud-art";

/**
 * Figma "Product landing page · V3": Tag cloud 740:37663. From xl up the chips sit at their Figma
 * positions in a 1160 x 234 frame, joined by the faint connector lines; below that they wrap
 * as a centred row and the lines are dropped. Strong chips carry an icon, muted ones a bullet on
 * each side.
 */
type Chip = { label: string; left: number; top: number; icon?: keyof typeof CHIP_ICONS };

// In reading order (row by row), which is also the order a screen reader and the wrapped row use.
const CHIPS: Chip[] = [
  { label: "Research", left: 60, top: 8 },
  { label: "Portfolio", left: 252, top: 8, icon: "palette" },
  { label: "Wireframing", left: 446, top: 8 },
  { label: "First design job", left: 659, top: 8, icon: "route" },
  { label: "Prototyping", left: 907, top: 8 },
  { label: "Brand identity", left: 220, top: 88 },
  { label: "Design systems", left: 445, top: 88, icon: "layout-template" },
  { label: "SEO", left: 698, top: 88 },
  { label: "Motion", left: 851, top: 88 },
  { label: "Career switch", left: 20, top: 168, icon: "sparkles" },
  { label: "Accessibility", left: 257, top: 168 },
  { label: "Dev handoff", left: 472, top: 168, icon: "package" },
  { label: "Critique", left: 694, top: 168 },
  { label: "Typography", left: 876, top: 168, icon: "book-open" },
];

function ChipView({ chip }: { chip: Chip }) {
  const position = "xl:absolute xl:top-(--top) xl:left-(--left)";
  const style = { "--left": `${chip.left}px`, "--top": `${chip.top}px` } as React.CSSProperties;
  if (chip.icon) {
    return (
      <li
        style={style}
        className={`${position} flex items-center gap-2.5 rounded-lg border border-border bg-bg-base px-4 py-2.5 transition duration-200 hover:-translate-y-0.5 hover:border-primary-border`}
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-primary"
        >
          {(CHIP_ICONS[chip.icon] ?? []).map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
        <span className="whitespace-nowrap font-semibold text-[18px] text-text leading-7 tracking-[-0.18px]">
          {chip.label}
        </span>
      </li>
    );
  }
  return (
    <li
      style={style}
      className={`${position} flex items-center gap-2.5 whitespace-nowrap rounded-md border border-border-soft bg-bg-base px-3 py-2 font-medium text-text-tertiary transition duration-200 hover:-translate-y-0.5 hover:border-border hover:text-text-secondary`}
    >
      <span aria-hidden="true" className="text-[14px] leading-5 tracking-[-0.14px]">
        •
      </span>
      <span className="text-[16px] leading-6 tracking-[-0.16px]">{chip.label}</span>
      <span aria-hidden="true" className="text-[14px] leading-5 tracking-[-0.14px]">
        •
      </span>
    </li>
  );
}

export function TagCloud() {
  return (
    <section aria-labelledby="tag-cloud-heading" className="px-5 lg:px-8">
      <div className="mx-auto flex max-w-[1240px] flex-col items-center gap-10 border-border-soft border-r border-l px-4 py-16 md:gap-14 md:px-10 md:pt-28 md:pb-24">
        <h2
          id="tag-cloud-heading"
          className="max-w-[760px] text-center font-medium text-[36px] text-text leading-[42px] tracking-[-0.01em] md:text-[56px] md:leading-[62px]"
        >
          Nothing should stand between you and learning
        </h2>
        <div className="relative w-full overflow-clip xl:h-[234px]">
          <div className="xl:-ml-[580px] xl:absolute xl:left-1/2 xl:h-[234px] xl:w-[1160px]">
            <div aria-hidden="true" className="absolute inset-0 hidden text-border-soft xl:block">
              {CLOUD_LINES.map((line) => (
                <div
                  key={`${line.left}-${line.top}-${line.d}`}
                  className="absolute"
                  style={{
                    left: line.left,
                    top: line.top,
                    width: line.width,
                    height: line.height,
                  }}
                >
                  <svg
                    aria-hidden="true"
                    viewBox={line.viewBox}
                    preserveAspectRatio="none"
                    fill="none"
                    stroke="currentColor"
                    className="absolute block max-w-none"
                    style={{
                      left: `${-line.ix}%`,
                      top: `${-line.iy}%`,
                      width: `${100 + 2 * line.ix}%`,
                      height: `${100 + 2 * line.iy}%`,
                    }}
                  >
                    <path d={line.d} />
                  </svg>
                </div>
              ))}
            </div>
            <ul className="flex flex-wrap justify-center gap-3 xl:block">
              {CHIPS.map((chip) => (
                <ChipView key={chip.label} chip={chip} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
