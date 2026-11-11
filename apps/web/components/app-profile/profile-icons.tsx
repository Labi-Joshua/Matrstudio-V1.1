import type { ReactNode, SVGProps } from "react";

/** Icons for the profile screens (Lucide look: 24px grid, 1.5 stroke). Decoration only. */
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

export const UserIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Glyph>
);

export const LockIcon = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Glyph>
);

export const TrophyIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
  </Glyph>
);

export const PencilIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
    <path d="m15 5 4 4" />
  </Glyph>
);

export const CopyIcon = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Glyph>
);

export const ExternalLinkIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M15 3h6v6M10 14 21 3M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
  </Glyph>
);

export const InfoCircleIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </Glyph>
);

export const TickIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m5 12 5 5 9-10" />
  </Glyph>
);
