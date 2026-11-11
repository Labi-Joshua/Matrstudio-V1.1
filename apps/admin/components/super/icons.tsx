import type { ReactNode, SVGProps } from "react";

/** Lucide-style icons (24px grid, 1.5 stroke) as inline SVG; decoration only. */
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

export const ArrowLeftIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m12 19-7-7 7-7M19 12H5" />
  </Glyph>
);
export const PlusIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M5 12h14M12 5v14" />
  </Glyph>
);
export const UserPlusIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6M22 11h-6" />
  </Glyph>
);
export const UsersIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Glyph>
);
export const KeyIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.7 12.3 9.8-9.8M16 7l3 3M14 9l2 2" />
  </Glyph>
);
export const ShieldIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </Glyph>
);
export const LockIcon = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Glyph>
);
export const TrashIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
  </Glyph>
);
export const LogOutIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Glyph>
);
export const ClockIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Glyph>
);
export const MailIcon = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </Glyph>
);
export const ScrollIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M19 17V5a2 2 0 0 0-2-2H4M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3M15 8h-4M15 12h-4" />
  </Glyph>
);
export const CopyIcon = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="8" y="8" width="14" height="14" rx="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Glyph>
);
export const UploadIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </Glyph>
);
export const XIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Glyph>
);
export const CheckCircleIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </Glyph>
);
export const AlertIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </Glyph>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m6 9 6 6 6-6" />
  </Glyph>
);
export const WifiOffIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m2 2 20 20M8.5 16.5a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.7M13.9 10.4a10 10 0 0 1 5.1 2.5M12 20h.01" />
  </Glyph>
);
export const SearchIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Glyph>
);
