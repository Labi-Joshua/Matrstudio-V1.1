import type { ReactNode, SVGProps } from "react";
import { highlightSegments } from "../../lib/app/command-match";
import type { CommandRow } from "../../lib/app/command-search";
import { THEME_STORAGE_KEY } from "../../lib/theme";
import { NavGlyph, SearchIcon, SparklesIcon, UploadIcon } from "../app/icons";
import { KIND_ICON, SampleTag, TypeBadge } from "../app-library/art";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Glyph({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

const ClockIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Glyph>
);

const UserIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Glyph>
);

const TrashIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
  </Glyph>
);

const ArrowIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Glyph>
);

/** Same `matr:theme-change` event the Theme switch listens to, so the sidebar and menu stay in step. */
export function applyTheme(value: "dark" | "light" | "system") {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = value === "system" ? (dark ? "dark" : "light") : value;
  try {
    if (value === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Storage can be blocked; the choice still applies for this visit.
  }
  window.dispatchEvent(new Event("matr:theme-change"));
}

function RowIcon({ row }: { row: CommandRow }) {
  if (row.kind) {
    const Icon = KIND_ICON[row.kind];
    return <Icon size={18} />;
  }
  switch (row.icon) {
    case "home":
    case "paths":
    case "library":
    case "saved":
    case "help":
    case "settings":
      return <NavGlyph icon={row.icon} size={18} />;
    case "profile":
      return <UserIcon size={18} />;
    case "submit":
      return <UploadIcon size={18} />;
    case "theme":
      return <SparklesIcon size={18} />;
    case "recent":
      return <ClockIcon size={18} />;
    case "clear":
      return <TrashIcon size={18} />;
    case "all":
      return <SearchIcon size={18} />;
  }
}

/** Plain text with the matched words marked. Rendered as text nodes, never as HTML. */
export function Highlighted({ text, terms }: { text: string; terms: readonly string[] }) {
  if (terms.length === 0) return <>{text}</>;
  let at = 0;
  return (
    <>
      {highlightSegments(text, terms).map((segment) => {
        const key = at;
        at += segment.text.length;
        return segment.match ? (
          <mark key={key} className="rounded-[3px] bg-primary-focus text-primary-text">
            {segment.text}
          </mark>
        ) : (
          <span key={key}>{segment.text}</span>
        );
      })}
    </>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="rounded-md border border-border-soft bg-bg-fill2 px-1.5 py-0.5 font-medium font-sans text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]"
    >
      {children}
    </span>
  );
}

/** One option of the listbox (Figma has no frame for the palette: built from the Library card language). */
export function Option({
  row,
  id,
  active,
  terms,
  onHover,
  onPick,
}: {
  row: CommandRow;
  id: string;
  active: boolean;
  terms: readonly string[];
  onHover: () => void;
  onPick: () => void;
}) {
  const showMeta = row.meta || row.sample;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input owns the keyboard (aria-activedescendant)
    <div
      role="option"
      id={id}
      aria-selected={active}
      tabIndex={-1}
      onMouseMove={onHover}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${
        active ? "bg-bg-fill2" : ""
      }`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary">
        <RowIcon row={row} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
          <Highlighted text={row.title} terms={terms} />
        </span>
        {showMeta ? (
          <span className="flex min-w-0 items-center gap-2 text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
            {row.meta ? <span className="truncate">{row.meta}</span> : null}
            {row.sample ? <SampleTag /> : null}
          </span>
        ) : null}
      </span>
      {row.kind ? <TypeBadge kind={row.kind} /> : null}
      {row.icon === "all" || row.group === "paths" ? (
        <ArrowIcon size={16} className="shrink-0 text-text-tertiary" />
      ) : null}
      {active ? <Kbd>↵</Kbd> : null}
    </div>
  );
}
