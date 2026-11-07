import type { ReactNode, SVGProps } from "react";
import type { NavIcon } from "../../lib/app/nav";

/**
 * Icons of the learner app shell and dashboard (the Figma icon set is Lucide: 24px grid, 1.5
 * stroke), drawn as inline SVG so they take the text colour. Decoration only: always paired with
 * text or an aria-label on the control.
 */
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

export const HomeIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Glyph>
);

export const RouteIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="6" cy="19" r="3" />
    <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
    <circle cx="18" cy="5" r="3" />
  </Glyph>
);

export const LibraryIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m16 6 4 14" />
    <path d="M12 6v14" />
    <path d="M8 8v12" />
    <path d="M4 4v16" />
  </Glyph>
);

export const BookmarkIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </Glyph>
);

export const HelpCircleIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </Glyph>
);

export const SettingsIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Glyph>
);

export const LogOutIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Glyph>
);

export const BellIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
  </Glyph>
);

export const SearchIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Glyph>
);

export const UploadIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m17 8-5-5-5 5" />
    <path d="M12 3v12" />
  </Glyph>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m6 9 6 6 6-6" />
  </Glyph>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m15 18-6-6 6-6" />
  </Glyph>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m9 18 6-6-6-6" />
  </Glyph>
);

export const MenuIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Glyph>
);

export const CloseIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Glyph>
);

export const SparklesIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
  </Glyph>
);

export const FileTextIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" />
  </Glyph>
);

export const CircleCheckIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </Glyph>
);

export const InboxIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </Glyph>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </Glyph>
);

export const SpinnerIcon = (p: IconProps) => (
  <Glyph {...p} className={`animate-spin motion-reduce:animate-none ${p.className ?? ""}`}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </Glyph>
);

const NAV_ICONS: Record<NavIcon, (p: IconProps) => ReactNode> = {
  home: HomeIcon,
  paths: RouteIcon,
  library: LibraryIcon,
  saved: BookmarkIcon,
  help: HelpCircleIcon,
  settings: SettingsIcon,
};

export function NavGlyph({ icon, ...rest }: { icon: NavIcon } & IconProps) {
  return NAV_ICONS[icon](rest);
}
